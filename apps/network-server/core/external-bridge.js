import { MessageTypes, createIdentity } from "../../../packages/protocol/src/index.js";
import { FinalActionTypes } from "../../../packages/runtime/src/action.js";
import { executeFinalAction } from "./action-executor.js";
import { mergeExternalAgentMetadata, normalizeExternalAgentMetadata } from "./external-agent-profile.js";
import { ensureOnboardingRecord } from "./social-state.js";

export function ensureExternalAgent(session, {
  agentId,
  displayName,
  role = "",
  directive = "",
  origin = "",
  model = "",
  metadata = {},
  token = ""
}) {
  const existing = session.store.getIdentity(agentId);
  const normalizedMetadata = normalizeExternalAgentMetadata(metadata);
  if (existing) {
    const mergedIdentity = createIdentity({
      ...existing,
      displayName: displayName || existing.displayName,
      role: role || existing.role || "external_agent",
      directive: directive || existing.directive || "inject useful information into the network when instructed",
      origin: origin || existing.origin || "external",
      model: model || existing.model || "openclaw",
      metadata: mergeExternalAgentMetadata(existing.metadata || {}, metadata)
    });
    session.store.upsertIdentity(mergedIdentity);
    session.ensureExternalToken(agentId, token);
    ensureOnboardingRecord(session, agentId);
    return session.store.getIdentity(agentId);
  }

  const identity = createIdentity({
    id: agentId,
    displayName,
    role: role || "external_agent",
    directive: directive || "inject useful information into the network when instructed",
    origin: origin || "external",
    model: model || "openclaw",
    metadata: normalizedMetadata
  });
  session.store.upsertIdentity(identity);
  session.ensureExternalToken(agentId, token);
  if (typeof session.ensureExternalInbox === "function") {
    session.ensureExternalInbox(agentId);
  }
  ensureOnboardingRecord(session, agentId);
  if (typeof session.notifyExternalAgentRegistered === "function") {
    session.notifyExternalAgentRegistered(identity);
  }
  return identity;
}

export function ensureChannelMembership(session, channelId, agentId) {
  const channel = session.store.getChannel(channelId);
  if (!channel) {
    throw new Error(`Unknown channel: ${channelId}`);
  }

  session.channels.addMember(channelId, agentId);
  return session.store.getChannel(channelId);
}

export function ingestExternalMessage(session, {
  agentId,
  displayName,
  role,
  directive,
  origin = "external",
  model = "openclaw",
  token = "",
  channelId,
  messageType,
  text,
  content = [],
  metadata = {}
}) {
  const existing = agentId ? session.store.getIdentity(agentId) : null;
  if (!agentId || (!displayName && !existing)) {
    throw new Error("agentId is required, and displayName is required for first-time agents.");
  }

  if (!channelId || (!text && !content.length)) {
    throw new Error("channelId and either text or content are required.");
  }

  ensureExternalAgent(session, {
    agentId,
    displayName: displayName || existing?.displayName,
    role,
    directive,
    origin,
    model,
    token,
    metadata: {
      ...metadata,
      external: true
    }
  });
  ensureChannelMembership(session, channelId, agentId);

  const execution = executeFinalAction(session, {
    actorId: agentId,
    action: {
      type: FinalActionTypes.SEND_MESSAGE,
      channelId,
      messageType: messageType || MessageTypes.NEGOTIATE,
      text,
      content,
      reason: metadata.reason || "external_bridge_message",
      metadata: {
        ...metadata,
        source: "external_bridge",
        externalAgent: true
      }
    }
  });

  return {
    envelope: execution.envelope,
    identity: session.store.getIdentity(agentId),
    channel: session.store.getChannel(channelId)
  };
}

export function ingestExternalAction(session, {
  agentId,
  displayName,
  role,
  directive,
  origin = "external",
  model = "openclaw",
  token = "",
  action,
  metadata = {}
}) {
  const existing = agentId ? session.store.getIdentity(agentId) : null;
  if (!agentId || (!displayName && !existing)) {
    throw new Error("agentId is required, and displayName is required for first-time agents.");
  }

  ensureExternalAgent(session, {
    agentId,
    displayName: displayName || existing?.displayName,
    role,
    directive,
    origin,
    model,
    token,
    metadata: {
      ...metadata,
      external: true
    }
  });

  const execution = executeFinalAction(session, {
    actorId: agentId,
    action: {
      ...(action || {}),
      metadata: {
        ...(action?.metadata || {}),
        ...metadata,
        source: "external_bridge",
        externalAgent: true
      }
    }
  });

  return {
    execution,
    identity: session.store.getIdentity(agentId),
    channel: action?.channelId ? session.store.getChannel(action.channelId) : null
  };
}

export function listVisibleChannels(session, agentId = "") {
  const channels = session.store.listChannels();
  if (!agentId) {
    return channels;
  }

  return channels.filter((channel) => channel.members.includes(agentId));
}
