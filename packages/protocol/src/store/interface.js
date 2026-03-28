export class StoreInterface {
  upsertIdentity() {
    throw new Error("StoreInterface.upsertIdentity() must be implemented.");
  }

  getIdentity() {
    throw new Error("StoreInterface.getIdentity() must be implemented.");
  }

  listIdentities() {
    throw new Error("StoreInterface.listIdentities() must be implemented.");
  }

  upsertChannel() {
    throw new Error("StoreInterface.upsertChannel() must be implemented.");
  }

  getChannel() {
    throw new Error("StoreInterface.getChannel() must be implemented.");
  }

  listChannels() {
    throw new Error("StoreInterface.listChannels() must be implemented.");
  }

  appendEnvelope() {
    throw new Error("StoreInterface.appendEnvelope() must be implemented.");
  }

  listEnvelopes() {
    throw new Error("StoreInterface.listEnvelopes() must be implemented.");
  }

  upsertOnboarding() {
    throw new Error("StoreInterface.upsertOnboarding() must be implemented.");
  }

  getOnboarding() {
    throw new Error("StoreInterface.getOnboarding() must be implemented.");
  }

  appendReaction() {
    throw new Error("StoreInterface.appendReaction() must be implemented.");
  }

  listReactions() {
    throw new Error("StoreInterface.listReactions() must be implemented.");
  }

  appendReputationEvent() {
    throw new Error("StoreInterface.appendReputationEvent() must be implemented.");
  }

  getReputationEvents() {
    throw new Error("StoreInterface.getReputationEvents() must be implemented.");
  }
}
