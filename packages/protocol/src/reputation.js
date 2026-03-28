import { assertObject, assertOptionalObject, assertString, clone } from "./utils.js";

export function createReputationEvent(spec) {
  assertObject(spec, "reputationEvent");
  assertString(spec.id, "reputationEvent.id");
  assertString(spec.agentId, "reputationEvent.agentId");
  assertString(spec.kind, "reputationEvent.kind");
  assertString(spec.summary, "reputationEvent.summary");
  assertOptionalObject(spec.data, "reputationEvent.data");

  return clone({
    id: spec.id,
    agentId: spec.agentId,
    kind: spec.kind,
    delta: spec.delta ?? 0,
    summary: spec.summary,
    data: spec.data || {},
    timestamp: spec.timestamp ?? Date.now()
  });
}

export class ReputationLedger {
  constructor(store) {
    this.store = store;
  }

  record(eventSpec) {
    const event = createReputationEvent(eventSpec);
    this.store.appendReputationEvent(event);
    return event;
  }

  getScore(agentId) {
    return this.store
      .getReputationEvents(agentId)
      .reduce((sum, event) => sum + (event.delta || 0), 0);
  }
}
