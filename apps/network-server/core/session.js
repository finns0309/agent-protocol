import {
  ChannelDirectory,
  MemoryStore,
  createEnvelope
} from "../../../packages/protocol/src/index.js";
import {
  Agent,
  MockToolUsingAdapter,
  TriggerTypes,
  createMiniMaxToolUseAdapter
} from "../../../packages/runtime/src/index.js";
import { randomBytes } from "node:crypto";
import {
  ensureChannelMembership,
  ensureExternalAgent,
  ingestExternalAction,
  ingestExternalMessage,
  listVisibleChannels
} from "./external-bridge.js";
import { processQueue, enqueueForMessage } from "./orchestrator.js";
import { buildSessionSnapshot } from "./projection.js";
import { AgentPushHub } from "./push-hub.js";
import { buildDefaultScenario } from "./scenario.js";
import { syncSocialStateForEnvelope } from "./social-state.js";
import { createSessionToolRegistry } from "./tools.js";

export class AgentNetworkSession {
  constructor({ sessionId = "", name = "", scenario = null } = {}) {
    const resolvedScenario = scenario || buildDefaultScenario();
    this.id = sessionId || `session-${Date.now()}`;
    this.name = name || resolvedScenario.name || this.id;
    this.scenarioId = resolvedScenario.id || "default";
    this.workspaceName = resolvedScenario.workspaceName || resolvedScenario.name || "Workspace";
    this.scenario = resolvedScenario;
    this.createdAt = Date.now();
    this.lastUpdatedAt = this.createdAt;
    this.store = new MemoryStore();
    this.channels = new ChannelDirectory(this.store);
    this.queue = [];
    this.externalInboxes = new Map();
    this.processed = new Set();
    this.tracesByMessageId = new Map();
    this.traceLog = [];
    this.externalTokens = new Map();
    this.pushHub = new AgentPushHub();
    this.running = false;
    this.processing = false;
    this.ids = {
      trigger: 1,
      envelope: 1,
      reaction: 1,
      reputation: 1
    };

    const llm = process.env.MINIMAX_API_KEY ? createMiniMaxToolUseAdapter() : new MockToolUsingAdapter();
    this.tools = createSessionToolRegistry(this);
    this.agents = new Map();

    for (const profile of resolvedScenario.createProfiles()) {
      this.store.upsertIdentity(profile.identity);
      this.agents.set(
        profile.identity.id,
        new Agent({
          identity: profile.identity,
          personaPrompt: profile.persona,
          worldPrompt: resolvedScenario.worldPrompt || "",
          capabilityProfile: profile.capabilityProfile,
          memory: profile.memory,
          llm,
          tools: this.tools
        })
      );
    }

    resolvedScenario.seedChannels(this.channels);
  }

  nextId(prefix) {
    const value = this.ids[prefix];
    this.ids[prefix] += 1;
    return `${prefix}-${value}`;
  }

  enqueueTrigger(agentId, {
    type = TriggerTypes.SYSTEM,
    actorId = "",
    channelId = "",
    messageId = "",
    summary = "",
    data = {},
    timestamp = Date.now()
  } = {}) {
    if (!agentId) {
      return null;
    }

    const trigger = {
      id: this.nextId("trigger"),
      type,
      actorId,
      channelId,
      messageId,
      summary,
      data,
      timestamp
    };

    if (this.agents.has(agentId)) {
      this.queue.push({
        agentId,
        attempts: 0,
        trigger
      });
      return trigger;
    }

    if (typeof this.pushExternalTrigger === "function") {
      this.pushExternalTrigger(agentId, trigger);
      return trigger;
    }

    return null;
  }

  notifyExternalAgentRegistered(identity) {
    const recipients = Array.isArray(this.scenario?.registrationTriggerRecipients)
      ? this.scenario.registrationTriggerRecipients
      : [];
    if (!recipients.length || !identity?.id) {
      return [];
    }

    const summary = `${identity.displayName || identity.id} joined the network`;
    const data = {
      joinedAgentId: identity.id,
      joinedDisplayName: identity.displayName || identity.id,
      joinedRole: identity.role || "",
      joinedOrigin: identity.origin || "external",
      joinedDirective: identity.directive || "",
      externalAgent: true
    };

    return recipients
      .filter((recipientId) => recipientId && recipientId !== identity.id)
      .map((recipientId) =>
        this.enqueueTrigger(recipientId, {
          type: TriggerTypes.MEMBER_JOINED,
          actorId: identity.id,
          summary,
          data: {
            ...data,
            recipientId
          }
        })
      )
      .filter(Boolean);
  }

  appendMessage({ from, channelId, type, text, content = [], replyTo = "", metadata = {} }) {
    const envelope = createEnvelope({
      id: this.nextId("envelope"),
      from,
      channelId,
      type,
      replyTo,
      payload: {
        text,
        content
      },
      metadata
    });
    this.store.appendEnvelope(envelope);
    syncSocialStateForEnvelope(this, envelope);
    enqueueForMessage(this, envelope);
    this.lastUpdatedAt = Date.now();
    return envelope;
  }

  hasRespondedInChannel(channelId, agentId) {
    return this.store.listEnvelopes({ channelId }).some((envelope) => envelope.from === agentId);
  }

  ensureExternalInbox(agentId) {
    if (!this.externalInboxes.has(agentId)) {
      this.externalInboxes.set(agentId, []);
    }
    return this.externalInboxes.get(agentId);
  }

  pushExternalTrigger(agentId, trigger) {
    const inbox = this.ensureExternalInbox(agentId);
    inbox.push(trigger);
    if (inbox.length > 100) {
      inbox.splice(0, inbox.length - 100);
    }
    this.pushHub.publish(agentId, "trigger", trigger);
    return inbox;
  }

  listExternalInbox(agentId, limit = 20) {
    const inbox = this.ensureExternalInbox(agentId);
    return inbox.slice(-limit);
  }

  acknowledgeExternalInbox(agentId, triggerIds = []) {
    const inbox = this.ensureExternalInbox(agentId);
    if (!triggerIds.length) {
      this.externalInboxes.set(agentId, []);
      return [];
    }

    const keep = inbox.filter((trigger) => !triggerIds.includes(trigger.id));
    this.externalInboxes.set(agentId, keep);
    return keep;
  }

  ensureExternalToken(agentId, preferredToken = "") {
    if (this.externalTokens.has(agentId)) {
      return this.externalTokens.get(agentId);
    }

    const token = preferredToken || `agt_${randomBytes(18).toString("hex")}`;
    this.externalTokens.set(agentId, token);
    return token;
  }

  validateExternalToken(agentId, token = "") {
    const expected = this.externalTokens.get(agentId);
    if (!expected) {
      return false;
    }
    return token === expected;
  }

  hasExternalToken(agentId) {
    return this.externalTokens.has(agentId);
  }

  listChannelMessages(agentId, channelId, limit = 20) {
    const channel = this.store.getChannel(channelId);
    if (!channel) {
      throw new Error(`Unknown channel: ${channelId}`);
    }
    if (agentId && !channel.members.includes(agentId)) {
      throw new Error(`Agent ${agentId} cannot access channel: ${channelId}`);
    }
    return this.store.listEnvelopes({ channelId }).slice(-limit);
  }

  getIdentityView(agentId) {
    return this.store.getIdentity(agentId);
  }

  ensureExternalAgent(spec) {
    return ensureExternalAgent(this, spec);
  }

  ensureChannelMembership(channelId, agentId) {
    return ensureChannelMembership(this, channelId, agentId);
  }

  ingestExternalMessage(spec) {
    return ingestExternalMessage(this, spec);
  }

  ingestExternalAction(spec) {
    return ingestExternalAction(this, spec);
  }

  listVisibleChannels(agentId = "") {
    return listVisibleChannels(this, agentId);
  }

  async start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.scenario.seedInitialMessages(this);
    processQueue(this).catch((error) => {
      console.error("[network-session] process loop failed", error);
    });
  }

  snapshot() {
    return buildSessionSnapshot(this);
  }
}
