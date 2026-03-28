import {
  ChannelModes,
  MessageTypes,
  PresenceStates,
  ReactionTypes,
  TrustStates,
  addIntroduction,
  addTaskOffer,
  createOnboardingRecord,
  extractTextFromPayload,
  finalizeOnboarding
} from "../../../packages/protocol/src/index.js";

function isExternalIdentity(identity) {
  return Boolean(identity) && (identity.origin === "external" || identity.metadata?.external === true);
}

function extractMentionedAgentIds(text = "") {
  const matches = String(text || "")
    .match(/@([a-zA-Z0-9_-]+)/g)
    ?.map((value) => value.slice(1).toLowerCase()) || [];
  return Array.from(new Set(matches));
}

function readMentionedAgentIds(envelope, text = "") {
  const explicit = Array.isArray(envelope.metadata?.mentionedIds) ? envelope.metadata.mentionedIds : [];
  if (explicit.length) {
    return Array.from(new Set(explicit.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)));
  }
  return extractMentionedAgentIds(text);
}

function shorten(text = "", limit = 160) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 1)}…`;
}

function preserveRichSummary(text = "", limit = 4000) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 1)}…`;
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
  session.store.appendReaction({
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
  delta = 0,
  summary,
  data = {}
}) {
  session.store.appendReputationEvent({
    id: session.nextId("reputation"),
    agentId,
    kind,
    delta,
    summary,
    data
  });
}

function updateOnboarding(session, agentId, transform) {
  const record = ensureOnboardingRecord(session, agentId);
  if (!record) {
    return null;
  }

  const nextRecord = transform(record);
  if (!nextRecord) {
    return record;
  }

  return session.store.upsertOnboarding(nextRecord);
}

export function ensureOnboardingRecord(session, agentId) {
  const identity = session.store.getIdentity(agentId);
  if (!isExternalIdentity(identity)) {
    return null;
  }

  const existing = session.store.getOnboarding(agentId);
  if (existing) {
    return existing;
  }

  return session.store.upsertOnboarding(
    createOnboardingRecord({
      agentId,
      presenceState: PresenceStates.DISCOVERED,
      trustState: TrustStates.UNKNOWN,
      integrationOutcome: "pending",
      introductions: [],
      roleOffers: [],
      taskOffers: [],
      metadata: {
        createdFrom: "external_agent_registration",
        external: true
      }
    })
  );
}

export function syncSocialStateForMembership(session, {
  agentId,
  channelId
}) {
  const channel = session.store.getChannel(channelId);
  if (!channel || channel.mode === ChannelModes.DIRECT) {
    return null;
  }

  return updateOnboarding(session, agentId, (record) => {
    if ([PresenceStates.QUARANTINED, PresenceStates.REJECTED, PresenceStates.INTEGRATED].includes(record.presenceState)) {
      return record;
    }

    return finalizeOnboarding(record, {
      presenceState: PresenceStates.ADMITTED,
      integrationOutcome: record.integrationOutcome === "pending" ? "joined_channel" : record.integrationOutcome,
      metadata: {
        ...(record.metadata || {}),
        lastAdmittedChannelId: channelId,
        lastAdmittedAt: Date.now()
      }
    });
  });
}

function syncActorOnboardingFromEnvelope(session, envelope, text) {
  const actorId = envelope.from;
  const messageSummary = shorten(text || extractTextFromPayload(envelope.payload), 180);

  updateOnboarding(session, actorId, (record) => {
    if (envelope.type === MessageTypes.ANNOUNCE) {
      return finalizeOnboarding(
        addIntroduction(record, {
          by: actorId,
          channelId: envelope.channelId,
          envelopeId: envelope.id,
          summary: messageSummary
        }),
        {
          integrationOutcome: "introduced",
          metadata: {
            ...(record.metadata || {}),
            lastIntroductionChannelId: envelope.channelId,
            lastIntroductionAt: envelope.timestamp
          }
        }
      );
    }

    if ([MessageTypes.DELIVER, MessageTypes.CONFIRM].includes(envelope.type)) {
      appendReputationEvent(session, {
        agentId: actorId,
        kind: envelope.type === MessageTypes.DELIVER ? "delivery_signal" : "confirmation_signal",
        delta: envelope.type === MessageTypes.DELIVER ? 2 : 1,
        summary: `${actorId} sent a ${envelope.type} message in ${envelope.channelId}.`,
        data: {
          channelId: envelope.channelId,
          envelopeId: envelope.id
        }
      });

      return finalizeOnboarding(record, {
        presenceState: PresenceStates.INTEGRATED,
        trustState: TrustStates.TENTATIVELY_TRUSTED,
        integrationOutcome: envelope.type === MessageTypes.DELIVER ? "delivered_work" : "confirmed_collaboration",
        metadata: {
          ...(record.metadata || {}),
          lastContributionChannelId: envelope.channelId,
          lastContributionAt: envelope.timestamp
        }
      });
    }

    if (record.presenceState === PresenceStates.DISCOVERED) {
      return finalizeOnboarding(record, {
        presenceState: PresenceStates.OBSERVED,
        integrationOutcome: "participating_in_public_channels",
        metadata: {
          ...(record.metadata || {}),
          lastObservedChannelId: envelope.channelId,
          lastObservedAt: envelope.timestamp
        }
      });
    }

    return record;
  });
}

function syncMentionedExternalTargets(session, envelope, text) {
  const mentionedIds = readMentionedAgentIds(envelope, text);
  if (!mentionedIds.length) {
    return;
  }

  for (const targetId of mentionedIds) {
    if (targetId === envelope.from) {
      continue;
    }

    const targetIdentity = session.store.getIdentity(targetId);
    if (!isExternalIdentity(targetIdentity)) {
      continue;
    }

    const summary = preserveRichSummary(text, 4000) || `${envelope.from} mentioned ${targetId} in ${envelope.channelId}`;

    if ([MessageTypes.ANNOUNCE, MessageTypes.NEGOTIATE].includes(envelope.type)) {
      appendReaction(session, {
        actor: envelope.from,
        target: targetId,
        type: ReactionTypes.WELCOME,
        summary,
        channelId: envelope.channelId,
        envelopeId: envelope.id
      });
      continue;
    }

    if (envelope.type === MessageTypes.OFFER) {
      updateOnboarding(session, targetId, (record) =>
        addTaskOffer(record, {
          by: envelope.from,
          channelId: envelope.channelId,
          envelopeId: envelope.id,
          summary
        })
      );

      appendReaction(session, {
        actor: envelope.from,
        target: targetId,
        type: ReactionTypes.OFFER_TASK,
        summary,
        channelId: envelope.channelId,
        envelopeId: envelope.id
      });
      appendReputationEvent(session, {
        agentId: targetId,
        kind: "received_task_offer",
        delta: 1,
        summary: `${targetId} received a task offer from ${envelope.from}.`,
        data: {
          channelId: envelope.channelId,
          envelopeId: envelope.id
        }
      });
      continue;
    }

    if (envelope.type === MessageTypes.CONFIRM) {
      updateOnboarding(session, targetId, (record) =>
        finalizeOnboarding(record, {
          presenceState: PresenceStates.INTEGRATED,
          trustState: TrustStates.TENTATIVELY_TRUSTED,
          integrationOutcome: "accepted_into_collaboration",
          metadata: {
            ...(record.metadata || {}),
            acceptedBy: envelope.from,
            acceptedAt: envelope.timestamp,
            acceptedChannelId: envelope.channelId
          }
        })
      );

      appendReaction(session, {
        actor: envelope.from,
        target: targetId,
        type: ReactionTypes.ACCEPTED,
        summary,
        channelId: envelope.channelId,
        envelopeId: envelope.id
      });
      appendReputationEvent(session, {
        agentId: targetId,
        kind: "accepted_into_collaboration",
        delta: 2,
        summary: `${targetId} was explicitly confirmed for collaboration by ${envelope.from}.`,
        data: {
          channelId: envelope.channelId,
          envelopeId: envelope.id
        }
      });
    }
  }
}

export function syncSocialStateForEnvelope(session, envelope) {
  const actorIdentity = session.store.getIdentity(envelope.from);
  const text = extractTextFromPayload(envelope.payload);

  if (isExternalIdentity(actorIdentity)) {
    ensureOnboardingRecord(session, envelope.from);
    syncSocialStateForMembership(session, {
      agentId: envelope.from,
      channelId: envelope.channelId
    });
    syncActorOnboardingFromEnvelope(session, envelope, text);
  }

  syncMentionedExternalTargets(session, envelope, text);
}
