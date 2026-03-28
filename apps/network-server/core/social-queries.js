import { extractTextFromPayload } from "../../../packages/protocol/src/index.js";

function normalizeLimit(value, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

export function toChannelSummary(channel) {
  return {
    id: channel.id,
    name: channel.name,
    mode: channel.mode,
    topic: channel.metadata?.topic || "",
    visibility: channel.metadata?.visibility || "",
    memberCount: Array.isArray(channel.members) ? channel.members.length : 0
  };
}

export function getAgentChannelSummary(session, targetAgentId) {
  const channels = session.store
    .listChannels()
    .filter((channel) => channel.members.includes(targetAgentId))
    .map(toChannelSummary);

  return {
    agentId: targetAgentId,
    channelCount: channels.length,
    channels
  };
}

export function getChannelContext(session, channelId, limit = 5) {
  const channel = session.store.getChannel(channelId);
  const messages = session.store
    .listEnvelopes({ channelId })
    .slice(-normalizeLimit(limit, 5));

  return {
    channel: channel ? toChannelSummary(channel) : null,
    recentActivity: messages.map((message) => ({
      id: message.id,
      from: message.from,
      type: message.type,
      text: extractTextFromPayload(message.payload),
      timestamp: message.timestamp
    }))
  };
}

export function getCollaborationSnapshot(session, agentId, targetAgentId, limit = 8) {
  const safeLimit = normalizeLimit(limit, 8);
  const channels = session.store.listChannels();
  const sharedChannels = channels.filter(
    (channel) => channel.members.includes(agentId) && channel.members.includes(targetAgentId)
  );
  const sharedChannelIds = new Set(sharedChannels.map((channel) => channel.id));
  const recentInteractions = session.store
    .listEnvelopes()
    .filter((envelope) => {
      if (!sharedChannelIds.has(envelope.channelId)) {
        return false;
      }
      return envelope.from === agentId || envelope.from === targetAgentId;
    })
    .slice(-safeLimit)
    .map((envelope) => ({
      id: envelope.id,
      channelId: envelope.channelId,
      from: envelope.from,
      type: envelope.type,
      text: extractTextFromPayload(envelope.payload),
      timestamp: envelope.timestamp
    }));

  const directChannels = sharedChannels
    .filter((channel) => channel.mode === "direct")
    .map(toChannelSummary);
  const reactionsFrom = session.store.listReactions({ actor: targetAgentId }).filter((reaction) => reaction.target === agentId);
  const reactionsTo = session.store.listReactions({ actor: agentId }).filter((reaction) => reaction.target === targetAgentId);

  return {
    agentId,
    targetAgentId,
    sharedChannelCount: sharedChannels.length,
    sharedChannels: sharedChannels.map(toChannelSummary),
    directChannels,
    recentInteractions,
    reactionsFromTarget: reactionsFrom,
    reactionsToTarget: reactionsTo
  };
}

export function getTotalReputationScore(session, agentId) {
  return session.store
    .getReputationEvents(agentId)
    .reduce((sum, event) => sum + (event.delta || 0), 0);
}

export function getAgentSocialState(session, targetAgentId, limit = 6) {
  const safeLimit = normalizeLimit(limit, 6);

  return {
    agentId: targetAgentId,
    onboarding: session.store.getOnboarding(targetAgentId),
    recentReactions: session.store
      .listReactions({ target: targetAgentId })
      .slice(-safeLimit),
    reputationEvents: session.store
      .getReputationEvents(targetAgentId)
      .slice(-safeLimit),
    reputationScore: getTotalReputationScore(session, targetAgentId)
  };
}

export function buildSocialOverview(session, limit = 8) {
  const safeLimit = normalizeLimit(limit, 8);
  const identities = session.store.listIdentities();
  const externalAgents = identities.filter((identity) => identity.origin === "external" || identity.metadata?.external === true);
  const allReputationEvents = identities
    .flatMap((identity) => session.store.getReputationEvents(identity.id))
    .sort((left, right) => (left.timestamp || 0) - (right.timestamp || 0));

  return {
    newcomers: externalAgents.map((identity) => {
      const socialState = getAgentSocialState(session, identity.id, safeLimit);
      const channelSummary = getAgentChannelSummary(session, identity.id);

      return {
        id: identity.id,
        name: identity.displayName,
        role: identity.role || "",
        presenceState: socialState.onboarding?.presenceState || "",
        trustState: socialState.onboarding?.trustState || "",
        integrationOutcome: socialState.onboarding?.integrationOutcome || "",
        reputationScore: socialState.reputationScore,
        channelCount: channelSummary.channelCount
      };
    }),
    reputationLeaders: identities
      .map((identity) => ({
        id: identity.id,
        name: identity.displayName,
        score: getTotalReputationScore(session, identity.id)
      }))
      .filter((entry) => entry.score !== 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, safeLimit),
    recentReactions: session.store.listReactions().slice(-safeLimit),
    recentReputationEvents: allReputationEvents.slice(-safeLimit)
  };
}
