import { AgentNetworkSession } from "./session.js";

function summarizeSession(record) {
  const { session, ...meta } = record;
  const channels = session.store.listChannels();
  const envelopes = session.store.listEnvelopes();
  return {
    ...meta,
    workspaceName: session.workspaceName,
    stats: {
      agents: session.agents.size,
      channels: channels.length,
      messages: envelopes.length,
      externalAgents: session.store
        .listIdentities()
        .filter((identity) => identity.origin === "external" || identity.metadata?.external === true).length
    },
    updatedAt: session.lastUpdatedAt || session.createdAt
  };
}

export class SessionManager {
  constructor({ scenarioRegistry }) {
    this.scenarioRegistry = scenarioRegistry;
    this.sessions = new Map();
    this.defaultSessionId = "";
    this.nextSessionNumber = 1;
  }

  async ensureDefaultSession(defaultScenarioId = "", defaultName = "") {
    if (this.defaultSessionId) {
      return this.get(this.defaultSessionId);
    }

    const scenario = (defaultScenarioId && this.scenarioRegistry.get(defaultScenarioId)) || this.scenarioRegistry.first();
    if (!scenario) {
      throw new Error("no_scenarios_registered");
    }

    return this.create({
      scenarioId: scenario.id,
      name: defaultName || scenario.name,
      makeDefault: true
    });
  }

  list() {
    return Array.from(this.sessions.values())
      .map((record) => summarizeSession(record))
      .sort((left, right) => right.createdAt - left.createdAt);
  }

  get(sessionId = "") {
    if (!sessionId) {
      return this.defaultSessionId ? this.sessions.get(this.defaultSessionId)?.session || null : null;
    }
    return this.sessions.get(sessionId)?.session || null;
  }

  getMeta(sessionId = "") {
    if (!sessionId) {
      return this.defaultSessionId ? this.sessions.get(this.defaultSessionId) || null : null;
    }
    return this.sessions.get(sessionId) || null;
  }

  async create({ scenarioId, name = "", makeDefault = false }) {
    const scenario = this.scenarioRegistry.get(scenarioId);
    if (!scenario) {
      throw new Error(`unknown_scenario:${scenarioId}`);
    }

    const sessionId = `session-${this.nextSessionNumber++}`;
    const session = new AgentNetworkSession({
      sessionId,
      name: name || `${scenario.name} ${sessionId}`,
      scenario
    });
    await session.start();

    const record = {
      id: sessionId,
      name: session.name,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      createdAt: session.createdAt,
      session
    };
    this.sessions.set(sessionId, record);

    if (!this.defaultSessionId || makeDefault) {
      this.defaultSessionId = sessionId;
    }

    return session;
  }
}
