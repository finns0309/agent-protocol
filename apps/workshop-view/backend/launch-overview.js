function countChannelMessages(channels = []) {
  return channels.reduce(
    (sum, channel) => sum + (Array.isArray(channel.messages) ? channel.messages.length : 0),
    0
  );
}

function countExternalAgents(agents = []) {
  return agents.filter((agent) => agent.origin === "external" || agent.metadata?.external === true).length;
}

function summarizeChannel(channel) {
  const messages = Array.isArray(channel?.messages) ? channel.messages : [];
  const lastMessage = messages[messages.length - 1] || null;
  return {
    id: channel?.id || "",
    label: channel?.label || channel?.id || "",
    visibility: channel?.visibility || "",
    members: Number(channel?.members || 0),
    messageCount: messages.length,
    topic: channel?.topic || "",
    lastMessageType: lastMessage?.type || "",
    lastMessageAt: lastMessage?.timestamp || "",
    lastActorName: lastMessage?.actorName || ""
  };
}

function summarizeAgent(agent) {
  return {
    id: agent?.id || "",
    name: agent?.displayName || agent?.name || "",
    role: agent?.role || "",
    active: Boolean(agent?.active),
    messageCount: Number(agent?.messageCount || 0),
    toolCallCount: Number(agent?.toolCallCount || 0),
    channels: Array.isArray(agent?.channels) ? agent.channels.length : 0,
    isExternal: agent?.origin === "external" || agent?.metadata?.external === true
  };
}

function summarizeSession(session) {
  const agents = Array.isArray(session?.agents) ? session.agents : [];
  const channels = Array.isArray(session?.channels) ? session.channels : [];
  const eventLog = Array.isArray(session?.eventLog) ? session.eventLog : [];
  const sortedChannels = channels
    .map(summarizeChannel)
    .sort((left, right) => right.messageCount - left.messageCount || left.label.localeCompare(right.label));
  const sortedAgents = agents
    .map(summarizeAgent)
    .sort((left, right) => right.messageCount - left.messageCount || right.toolCallCount - left.toolCallCount);

  return {
    workspaceName: session?.workspace?.name || "",
    scenarioId: session?.workspace?.scenarioId || "",
    sessionId: session?.workspace?.sessionId || "",
    agentCount: agents.length,
    externalAgentCount: countExternalAgents(agents),
    channelCount: channels.length,
    messageCount: countChannelMessages(channels),
    activeChannelCount: channels.filter(
      (channel) => Array.isArray(channel.messages) && channel.messages.length > 0
    ).length,
    channels: sortedChannels.slice(0, 8),
    topAgents: sortedAgents.slice(0, 8),
    recentEvents: eventLog.slice(0, 6).map((event) => ({
      time: event.time || "",
      agent: event.agent || "",
      decisionType: event.decisionType || "",
      channelLabel: event.channelLabel || "",
      decisionSummary: event.decisionSummary || ""
    })),
    latestEvent: eventLog[0]
      ? {
          time: eventLog[0].time || "",
          agent: eventLog[0].agent || "",
          decisionType: eventLog[0].decisionType || "",
          channelLabel: eventLog[0].channelLabel || "",
          decisionSummary: eventLog[0].decisionSummary || ""
        }
      : null
  };
}

export async function fetchLaunchOverview(launch) {
  if (!launch?.urls?.networkApi || launch.status !== "running") {
    return null;
  }

  try {
    const response = await fetch(`${launch.urls.networkApi}/api/session?ts=${Date.now()}`);
    if (!response.ok) {
      return null;
    }
    const json = await response.json();
    return summarizeSession(json);
  } catch {
    return null;
  }
}
