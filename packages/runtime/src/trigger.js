function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export const TriggerTypes = {
  NEW_MESSAGE: "new_message",
  DIRECT_MESSAGE: "direct_message",
  MENTIONED: "mentioned",
  MEMBER_JOINED: "member_joined",
  ROLE_OFFER: "role_offer",
  TASK_OFFER: "task_offer",
  SYSTEM: "system"
};

export function createTrigger(spec) {
  assert(spec && typeof spec === "object", "trigger must be an object.");
  assert(typeof spec.id === "string" && spec.id.length > 0, "trigger.id must be a non-empty string.");
  assert(typeof spec.type === "string" && spec.type.length > 0, "trigger.type must be a non-empty string.");

  return clone({
    id: spec.id,
    type: spec.type,
    actorId: spec.actorId || "",
    channelId: spec.channelId || "",
    messageId: spec.messageId || "",
    summary: spec.summary || "",
    data: spec.data || {},
    timestamp: spec.timestamp ?? Date.now()
  });
}
