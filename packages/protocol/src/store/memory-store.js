import { createChannel } from "../channel.js";
import { createEnvelope } from "../envelope.js";
import { createIdentity } from "../identity.js";
import { createOnboardingRecord } from "../onboarding.js";
import { createReaction } from "../reaction.js";
import { createReputationEvent } from "../reputation.js";
import { clone } from "../utils.js";
import { StoreInterface } from "./interface.js";

export class MemoryStore extends StoreInterface {
  constructor() {
    super();
    this.identities = new Map();
    this.channels = new Map();
    this.envelopes = [];
    this.onboarding = new Map();
    this.reactions = [];
    this.reputationEvents = [];
  }

  upsertIdentity(identity) {
    const safe = createIdentity(identity);
    this.identities.set(safe.id, safe);
    return clone(safe);
  }

  getIdentity(id) {
    return clone(this.identities.get(id) || null);
  }

  listIdentities() {
    return clone(Array.from(this.identities.values()));
  }

  upsertChannel(channel) {
    const safe = createChannel(channel);
    this.channels.set(safe.id, safe);
    return clone(safe);
  }

  getChannel(channelId) {
    return clone(this.channels.get(channelId) || null);
  }

  listChannels() {
    return clone(Array.from(this.channels.values()));
  }

  appendEnvelope(envelope) {
    const safe = createEnvelope(envelope);
    this.envelopes.push(safe);
    return clone(safe);
  }

  listEnvelopes({ channelId = null, participant = null } = {}) {
    return clone(
      this.envelopes.filter((envelope) => {
        if (channelId && envelope.channelId !== channelId) {
          return false;
        }

        if (participant && envelope.from !== participant && envelope.to !== participant) {
          return false;
        }

        return true;
      })
    );
  }

  upsertOnboarding(record) {
    const safe = createOnboardingRecord(record);
    this.onboarding.set(safe.agentId, safe);
    return clone(safe);
  }

  getOnboarding(agentId) {
    return clone(this.onboarding.get(agentId) || null);
  }

  appendReaction(reaction) {
    const safe = createReaction(reaction);
    this.reactions.push(safe);
    return clone(safe);
  }

  listReactions({ target = null, actor = null } = {}) {
    return clone(
      this.reactions.filter((reaction) => {
        if (target && reaction.target !== target) {
          return false;
        }
        if (actor && reaction.actor !== actor) {
          return false;
        }
        return true;
      })
    );
  }

  appendReputationEvent(event) {
    const safe = createReputationEvent(event);
    this.reputationEvents.push(safe);
    return clone(safe);
  }

  getReputationEvents(agentId) {
    return clone(this.reputationEvents.filter((event) => event.agentId === agentId));
  }
}
