import {
  createMessagePayload,
  ChannelModes,
  MessageTypes,
  ReactionTypes
} from "../../../packages/protocol/src/index.js";
import {
  FinalActionTypes,
  createFinalAction
} from "../../../packages/runtime/src/action.js";
import { syncSocialStateForMembership } from "./social-state.js";

function normalizeMessageType(value, fallback = MessageTypes.NEGOTIATE) {
  const normalized = String(value || "").toUpperCase();
  return MessageTypes[normalized] || fallback;
}

function normalizeMentionedIds(finalAction, payload) {
  const explicit = Array.isArray(finalAction.mentionedIds) ? finalAction.mentionedIds : [];
  if (explicit.length) {
    return Array.from(new Set(explicit));
  }

  const source = String(payload.text || "");
  const matches = source.match(/@([a-zA-Z0-9_-]+)/g)?.map((value) => value.slice(1).toLowerCase()) || [];
  return Array.from(new Set(matches));
}

function normalizeDirectChannelId(actorId, peerId) {
  return ["dm", ...[actorId, peerId].map((value) => String(value || "").trim()).sort()].join("-");
}

function findEnvelopeById(session, envelopeId) {
  return session.store.listEnvelopes().find((envelope) => envelope.id === envelopeId) || null;
}

function appendReaction(session, {
  actor,
  target,
  type,
  summary,
  channelId = "",
  envelopeId = "",
  data = {}
}) {
  return session.store.appendReaction({
    id: session.nextId("reaction"),
    actor,
    target,
    type,
    summary,
    channelId,
    envelopeId,
    data
  });
}

function appendReputationEvent(session, {
  agentId,
  kind,
  delta,
  summary,
  data = {}
}) {
  return session.store.appendReputationEvent({
    id: session.nextId("reputation"),
    agentId,
    kind,
    delta,
    summary,
    data
  });
}

function ensureActorMembership(session, channelId, actorId) {
  const channel = session.store.getChannel(channelId);
  if (!channel) {
    throw new Error(`Unknown channel: ${channelId}`);
  }

  session.channels.addMember(channelId, actorId);
  syncSocialStateForMembership(session, {
    agentId: actorId,
    channelId
  });
  return session.store.getChannel(channelId);
}

function normalizeInitialMessageSpec(initialMessage, initialMessageType, defaultMessageType) {
  if (initialMessage && typeof initialMessage === "object" && !Array.isArray(initialMessage)) {
    return {
      text: String(initialMessage.text || "").trim(),
      messageType: normalizeMessageType(initialMessage.type || initialMessage.messageType || initialMessageType, defaultMessageType)
    };
  }

  return {
    text: String(initialMessage || "").trim(),
    messageType: normalizeMessageType(initialMessageType, defaultMessageType)
  };
}

export function executeFinalAction(session, {
  actorId,
  action,
  defaultMessageType = MessageTypes.NEGOTIATE,
  trace = null
}) {
  const finalAction = createFinalAction(action);

  switch (finalAction.type) {
    case FinalActionTypes.SEND_MESSAGE: {
      const payload = createMessagePayload({
        text: finalAction.text,
        content: finalAction.content
      });

      if (!finalAction.channelId || (!payload.text && !payload.content.length)) {
        throw new Error("send_message requires channelId and at least one content block or text.");
      }

      const normalizedMessageType = normalizeMessageType(finalAction.messageType, defaultMessageType);
      ensureActorMembership(session, finalAction.channelId, actorId);
      const mentionedIds = normalizeMentionedIds(finalAction, payload);

      const envelope = session.appendMessage({
        from: actorId,
        channelId: finalAction.channelId,
        type: normalizedMessageType,
        text: payload.text,
        content: payload.content,
        replyTo: finalAction.replyTo,
        metadata: {
          ...(finalAction.metadata || {}),
          mentionedIds,
          reason: finalAction.reason || ""
        }
      });

      if (trace) {
        session.tracesByMessageId.set(envelope.id, trace);
      }

      return {
        kind: FinalActionTypes.SEND_MESSAGE,
        envelope,
        channel: session.store.getChannel(finalAction.channelId)
      };
    }

    case FinalActionTypes.REACT: {
      const targetEnvelope = finalAction.targetMessageId ? findEnvelopeById(session, finalAction.targetMessageId) : null;
      const targetAgentId = finalAction.targetAgentId || targetEnvelope?.from || "";
      if (!targetAgentId) {
        throw new Error("react requires targetAgentId or targetMessageId.");
      }
      const reactionType = finalAction.reactionType || ReactionTypes.OBSERVE;
      const reaction = appendReaction(session, {
        actor: actorId,
        target: targetAgentId,
        type: reactionType,
        summary: finalAction.reason || `${actorId} reacted with ${reactionType}`,
        channelId: finalAction.channelId || targetEnvelope?.channelId || "",
        envelopeId: finalAction.targetMessageId || "",
        data: {
          ...(finalAction.metadata || {}),
          targetMessageId: finalAction.targetMessageId || ""
        }
      });

      if ([ReactionTypes.ENDORSE, ReactionTypes.ACCEPTED, ReactionTypes.WELCOME].includes(reactionType)) {
        appendReputationEvent(session, {
          agentId: targetAgentId,
          kind: `reaction_${reactionType}`,
          delta: reactionType === ReactionTypes.ENDORSE ? 2 : 1,
          summary: `${targetAgentId} received a ${reactionType} reaction from ${actorId}.`,
          data: {
            channelId: reaction.channelId,
            envelopeId: reaction.envelopeId
          }
        });
      }

      return {
        kind: FinalActionTypes.REACT,
        reaction
      };
    }

    case FinalActionTypes.CREATE_CHANNEL: {
      const channelId = finalAction.channelId;
      if (!channelId) {
        throw new Error("create_channel requires channelId.");
      }

      const existing = session.store.getChannel(channelId);
      if (existing) {
        return {
          kind: FinalActionTypes.CREATE_CHANNEL,
          channel: existing,
          created: false
        };
      }

      const members = Array.from(new Set([actorId, ...(finalAction.members || [])]));
      const channel = session.channels.create({
        id: channelId,
        mode: finalAction.metadata?.mode || ChannelModes.GROUP,
        name: finalAction.metadata?.name || channelId,
        members,
        metadata: finalAction.metadata || {}
      });

      for (const memberId of members) {
        syncSocialStateForMembership(session, {
          agentId: memberId,
          channelId
        });
      }

      let seedEnvelope = null;
      const initialMessageSpec = normalizeInitialMessageSpec(
        finalAction.metadata?.initialMessage,
        finalAction.metadata?.initialMessageType,
        defaultMessageType
      );
      if (initialMessageSpec.text) {
        seedEnvelope = session.appendMessage({
          from: actorId,
          channelId,
          type: initialMessageSpec.messageType,
          text: initialMessageSpec.text,
          metadata: {
            sourceAction: FinalActionTypes.CREATE_CHANNEL,
            createdChannel: channelId,
            reason: finalAction.reason || ""
          }
        });

        if (trace) {
          session.tracesByMessageId.set(seedEnvelope.id, trace);
        }
      }

      return {
        kind: FinalActionTypes.CREATE_CHANNEL,
        channel,
        created: true,
        envelope: seedEnvelope
      };
    }

    case FinalActionTypes.OPEN_DIRECT_CHANNEL: {
      const peerId = finalAction.peerId;
      if (!peerId) {
        throw new Error("open_direct_channel requires peerId.");
      }
      if (!session.store.getIdentity(peerId)) {
        throw new Error(`Unknown peer: ${peerId}`);
      }

      const channelId = finalAction.channelId || normalizeDirectChannelId(actorId, peerId);
      let channel = session.store.getChannel(channelId);
      const members = Array.from(new Set([actorId, peerId]));
      let created = false;
      if (!channel) {
        channel = session.channels.create({
          id: channelId,
          mode: ChannelModes.DIRECT,
          name: members.join(", "),
          members,
          metadata: {
            ...(finalAction.metadata || {}),
            directMembers: members
          }
        });
        created = true;
      }

      let envelope = null;
      const payload = createMessagePayload({
        text: finalAction.text,
        content: finalAction.content
      });
      if (payload.text || payload.content.length) {
        envelope = session.appendMessage({
          from: actorId,
          channelId,
          type: normalizeMessageType(finalAction.messageType, defaultMessageType),
          text: payload.text,
          content: payload.content,
          replyTo: finalAction.replyTo,
          metadata: {
            ...(finalAction.metadata || {}),
            mentionedIds: normalizeMentionedIds(finalAction, payload),
            sourceAction: FinalActionTypes.OPEN_DIRECT_CHANNEL,
            reason: finalAction.reason || ""
          }
        });
        if (trace) {
          session.tracesByMessageId.set(envelope.id, trace);
        }
      }

      return {
        kind: FinalActionTypes.OPEN_DIRECT_CHANNEL,
        channel: session.store.getChannel(channelId),
        created,
        envelope
      };
    }

    case FinalActionTypes.JOIN_CHANNEL: {
      if (!finalAction.channelId) {
        throw new Error("join_channel requires channelId.");
      }

      const channel = ensureActorMembership(session, finalAction.channelId, actorId);
      return {
        kind: FinalActionTypes.JOIN_CHANNEL,
        channel
      };
    }

    case FinalActionTypes.INVITE_MEMBERS: {
      if (!finalAction.channelId) {
        throw new Error("invite_members requires channelId.");
      }
      if (!(finalAction.members || []).length) {
        throw new Error("invite_members requires at least one member.");
      }

      const channel = session.store.getChannel(finalAction.channelId);
      if (!channel) {
        throw new Error(`Unknown channel: ${finalAction.channelId}`);
      }
      if (channel.mode === ChannelModes.DIRECT) {
        throw new Error("Cannot invite members into a direct channel.");
      }

      ensureActorMembership(session, finalAction.channelId, actorId);
      const addedMembers = [];
      for (const memberId of Array.from(new Set(finalAction.members))) {
        if (!memberId || !session.store.getIdentity(memberId)) {
          continue;
        }
        const currentChannel = session.store.getChannel(finalAction.channelId);
        const before = currentChannel?.members.includes(memberId);
        session.channels.addMember(finalAction.channelId, memberId);
        if (!before) {
          addedMembers.push(memberId);
          syncSocialStateForMembership(session, {
            agentId: memberId,
            channelId: finalAction.channelId
          });
        }
      }

      return {
        kind: FinalActionTypes.INVITE_MEMBERS,
        channel: session.store.getChannel(finalAction.channelId),
        addedMembers
      };
    }

    case FinalActionTypes.LEAVE_CHANNEL: {
      if (!finalAction.channelId) {
        throw new Error("leave_channel requires channelId.");
      }

      const channel = session.store.getChannel(finalAction.channelId);
      if (!channel) {
        throw new Error(`Unknown channel: ${finalAction.channelId}`);
      }

      if (channel.mode === ChannelModes.DIRECT) {
        throw new Error("Cannot leave a direct channel.");
      }

      channel.members = channel.members.filter((memberId) => memberId !== actorId);
      session.store.upsertChannel(channel);
      return {
        kind: FinalActionTypes.LEAVE_CHANNEL,
        channel
      };
    }

    case FinalActionTypes.PIN_MESSAGE: {
      const messageId = finalAction.messageId || finalAction.targetMessageId;
      if (!finalAction.channelId || !messageId) {
        throw new Error("pin_message requires channelId and messageId.");
      }

      const channel = session.store.getChannel(finalAction.channelId);
      if (!channel) {
        throw new Error(`Unknown channel: ${finalAction.channelId}`);
      }
      if (!channel.members.includes(actorId)) {
        throw new Error(`Actor ${actorId} cannot pin in channel: ${finalAction.channelId}`);
      }

      const targetEnvelope = findEnvelopeById(session, messageId);
      if (!targetEnvelope || targetEnvelope.channelId !== finalAction.channelId) {
        throw new Error(`Unknown message in channel: ${messageId}`);
      }

      const pinnedMessageIds = Array.from(
        new Set([...(channel.metadata?.pinnedMessageIds || []), messageId])
      );
      channel.metadata = {
        ...(channel.metadata || {}),
        pinnedMessageIds,
        lastPinnedMessageId: messageId,
        lastPinnedBy: actorId,
        lastPinnedAt: Date.now()
      };
      session.store.upsertChannel(channel);

      return {
        kind: FinalActionTypes.PIN_MESSAGE,
        channel,
        messageId
      };
    }

    case FinalActionTypes.PASS:
      return {
        kind: FinalActionTypes.PASS,
        action: finalAction
      };

    default:
      throw new Error(`Unsupported final action: ${finalAction.type}`);
  }
}
