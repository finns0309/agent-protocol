import { StoreInterface } from "./interface.js";

export class PostgresStore extends StoreInterface {
  constructor(config = {}) {
    super();
    this.config = config;
  }

  unsupported(methodName) {
    throw new Error(`PostgresStore.${methodName}() is not implemented yet. Use MemoryStore during protocol design.`);
  }

  upsertIdentity() {
    this.unsupported("upsertIdentity");
  }

  getIdentity() {
    this.unsupported("getIdentity");
  }

  listIdentities() {
    this.unsupported("listIdentities");
  }

  upsertChannel() {
    this.unsupported("upsertChannel");
  }

  getChannel() {
    this.unsupported("getChannel");
  }

  listChannels() {
    this.unsupported("listChannels");
  }

  appendEnvelope() {
    this.unsupported("appendEnvelope");
  }

  listEnvelopes() {
    this.unsupported("listEnvelopes");
  }

  upsertOnboarding() {
    this.unsupported("upsertOnboarding");
  }

  getOnboarding() {
    this.unsupported("getOnboarding");
  }

  appendReaction() {
    this.unsupported("appendReaction");
  }

  listReactions() {
    this.unsupported("listReactions");
  }

  appendReputationEvent() {
    this.unsupported("appendReputationEvent");
  }

  getReputationEvents() {
    this.unsupported("getReputationEvents");
  }
}
