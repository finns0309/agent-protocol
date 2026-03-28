import { assertObject, assertOneOf, assertOptionalObject, assertOptionalString, assertString, clone } from "./utils.js";

export const ReactionTypes = {
  WELCOME: "welcome",
  OBSERVE: "observe",
  SUSPICION: "suspicion",
  CHALLENGE_CAPABILITY: "challenge_capability",
  OFFER_TASK: "offer_task",
  OFFER_ROLE: "offer_role",
  DECLINE_INTERACTION: "decline_interaction",
  WARN_OTHERS: "warn_others",
  ENDORSE: "endorse",
  MARK_AS_THREAT: "mark_as_threat",
  ACCEPTED: "accepted"
};

const REACTION_TYPE_VALUES = new Set(Object.values(ReactionTypes));

export function createReaction(spec) {
  assertObject(spec, "reaction");
  assertString(spec.id, "reaction.id");
  assertString(spec.actor, "reaction.actor");
  assertString(spec.target, "reaction.target");
  assertString(spec.type, "reaction.type");
  assertOneOf(spec.type, REACTION_TYPE_VALUES, "reaction.type");
  assertString(spec.summary, "reaction.summary");
  assertOptionalString(spec.channelId, "reaction.channelId");
  assertOptionalString(spec.envelopeId, "reaction.envelopeId");
  assertOptionalObject(spec.data, "reaction.data");

  return clone({
    id: spec.id,
    actor: spec.actor,
    target: spec.target,
    type: spec.type,
    summary: spec.summary,
    channelId: spec.channelId || "",
    envelopeId: spec.envelopeId || "",
    data: spec.data || {},
    timestamp: spec.timestamp ?? Date.now()
  });
}
