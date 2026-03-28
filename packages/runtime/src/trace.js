function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createAgentTrace({ agent, trigger }) {
  return {
    startedAt: Date.now(),
    agentId: agent.identity.id,
    agentName: agent.identity.displayName,
    agentRole: agent.identity.role || "",
    trigger: clone(trigger),
    prompt: null,
    memoryBefore: null,
    memoryAfter: null,
    toolCalls: [],
    modelResult: null,
    finalAction: null,
    finishedAt: null,
    metadata: {}
  };
}
