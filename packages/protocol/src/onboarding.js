import { assertArray, assertObject, assertOneOf, assertOptionalObject, assertString, clone } from "./utils.js";

export const PresenceStates = {
  DISCOVERED: "discovered",
  REQUESTED_JOIN: "requested_join",
  INTRODUCED: "introduced",
  OBSERVED: "observed",
  ADMITTED: "admitted",
  QUARANTINED: "quarantined",
  REJECTED: "rejected",
  INTEGRATED: "integrated"
};

export const TrustStates = {
  UNKNOWN: "unknown",
  TENTATIVELY_TRUSTED: "tentatively_trusted",
  UNDER_WATCH: "under_watch",
  TRUSTED: "trusted",
  DISTRUSTED: "distrusted"
};

const PRESENCE_STATE_VALUES = new Set(Object.values(PresenceStates));
const TRUST_STATE_VALUES = new Set(Object.values(TrustStates));

export function createOnboardingRecord(spec) {
  assertObject(spec, "onboardingRecord");
  assertString(spec.agentId, "onboardingRecord.agentId");
  assertString(spec.presenceState, "onboardingRecord.presenceState");
  assertString(spec.trustState, "onboardingRecord.trustState");
  assertOneOf(spec.presenceState, PRESENCE_STATE_VALUES, "onboardingRecord.presenceState");
  assertOneOf(spec.trustState, TRUST_STATE_VALUES, "onboardingRecord.trustState");
  assertString(spec.integrationOutcome, "onboardingRecord.integrationOutcome");
  assertArray(spec.introductions || [], "onboardingRecord.introductions");
  assertArray(spec.roleOffers || [], "onboardingRecord.roleOffers");
  assertArray(spec.taskOffers || [], "onboardingRecord.taskOffers");
  assertOptionalObject(spec.metadata, "onboardingRecord.metadata");

  return clone({
    agentId: spec.agentId,
    presenceState: spec.presenceState,
    trustState: spec.trustState,
    integrationOutcome: spec.integrationOutcome,
    introductions: spec.introductions || [],
    roleOffers: spec.roleOffers || [],
    taskOffers: spec.taskOffers || [],
    metadata: spec.metadata || {}
  });
}

export function addIntroduction(record, introduction) {
  const safe = createOnboardingRecord(record);
  safe.introductions.push(clone(introduction));
  if (safe.presenceState === PresenceStates.REQUESTED_JOIN || safe.presenceState === PresenceStates.DISCOVERED) {
    safe.presenceState = PresenceStates.INTRODUCED;
  }
  return safe;
}

export function addRoleOffer(record, offer) {
  const safe = createOnboardingRecord(record);
  safe.roleOffers.push(clone(offer));
  return safe;
}

export function addTaskOffer(record, offer) {
  const safe = createOnboardingRecord(record);
  safe.taskOffers.push(clone(offer));
  return safe;
}

export function finalizeOnboarding(record, patch = {}) {
  return createOnboardingRecord({
    ...record,
    ...patch
  });
}
