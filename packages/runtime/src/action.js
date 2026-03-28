import { MessageTypes } from "../../protocol/src/envelope.js";
import { ReactionTypes } from "../../protocol/src/reaction.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export const FinalActionTypes = {
  SEND_MESSAGE: "send_message",
  CREATE_CHANNEL: "create_channel",
  JOIN_CHANNEL: "join_channel",
  LEAVE_CHANNEL: "leave_channel",
  REACT: "react",
  OPEN_DIRECT_CHANNEL: "open_direct_channel",
  INVITE_MEMBERS: "invite_members",
  PIN_MESSAGE: "pin_message",
  PASS: "pass"
};

const FINAL_ACTION_VALUES = new Set(Object.values(FinalActionTypes));
const MESSAGE_TYPE_VALUES = new Set(Object.values(MessageTypes));
const REACTION_TYPE_VALUES = new Set(Object.values(ReactionTypes));

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    )
  );
}

export function createFinalAction(spec) {
  assert(spec && typeof spec === "object", "final action must be an object.");

  const payload = isPlainObject(spec.payload) ? spec.payload : {};
  const normalizedType = spec.type || spec.action || "";
  const normalizedText = spec.text || spec.message || payload.text || payload.message || "";
  const normalizedChannelId = spec.channelId || spec.channel || "";
  const normalizedContent = spec.content || spec.blocks || payload.content || payload.blocks || [];
  const normalizedMessageType = spec.messageType || payload.messageType || "";
  const normalizedReplyTo = spec.replyTo || payload.replyTo || "";
  const normalizedMentionedIds = normalizeStringArray(spec.mentionedIds || payload.mentionedIds);
  const normalizedMetadata = spec.metadata || payload.metadata || {};

  assert(typeof normalizedType === "string" && normalizedType.length > 0, "finalAction.type must be a non-empty string.");
  assert(FINAL_ACTION_VALUES.has(normalizedType), `finalAction.type must be one of: ${Array.from(FINAL_ACTION_VALUES).join(", ")}.`);
  assert(typeof normalizedText === "string", "finalAction.text must be a string when provided.");
  assert(typeof normalizedChannelId === "string", "finalAction.channelId must be a string when provided.");
  assert(Array.isArray(normalizedContent), "finalAction.content must be an array when provided.");
  assert(spec.members == null || Array.isArray(spec.members), "finalAction.members must be an array when provided.");
  assert(spec.replyTo == null || typeof spec.replyTo === "string", "finalAction.replyTo must be a string when provided.");
  assert(spec.peerId == null || typeof spec.peerId === "string", "finalAction.peerId must be a string when provided.");
  assert(spec.targetAgentId == null || typeof spec.targetAgentId === "string", "finalAction.targetAgentId must be a string when provided.");
  assert(spec.targetMessageId == null || typeof spec.targetMessageId === "string", "finalAction.targetMessageId must be a string when provided.");
  assert(spec.messageId == null || typeof spec.messageId === "string", "finalAction.messageId must be a string when provided.");
  assert(spec.mentionedIds == null || Array.isArray(spec.mentionedIds), "finalAction.mentionedIds must be an array when provided.");
  assert(spec.reason == null || typeof spec.reason === "string", "finalAction.reason must be a string when provided.");
  assert(isPlainObject(normalizedMetadata), "finalAction.metadata must be an object when provided.");
  if (normalizedMessageType !== "") {
    assert(
      MESSAGE_TYPE_VALUES.has(normalizedMessageType),
      `finalAction.messageType must be one of: ${Array.from(MESSAGE_TYPE_VALUES).join(", ")}.`
    );
  }
  if (spec.reactionType != null && spec.reactionType !== "") {
    assert(
      REACTION_TYPE_VALUES.has(spec.reactionType),
      `finalAction.reactionType must be one of: ${Array.from(REACTION_TYPE_VALUES).join(", ")}.`
    );
  }

  return clone({
    type: normalizedType,
    channelId: normalizedChannelId,
    messageType: normalizedMessageType,
    text: normalizedText,
    content: Array.isArray(normalizedContent) ? normalizedContent : [],
    members: normalizeStringArray(spec.members),
    replyTo: normalizedReplyTo,
    mentionedIds: normalizedMentionedIds,
    peerId: spec.peerId || "",
    targetAgentId: spec.targetAgentId || "",
    targetMessageId: spec.targetMessageId || "",
    reactionType: spec.reactionType || "",
    messageId: spec.messageId || "",
    reason: spec.reason || "",
    metadata: normalizedMetadata
  });
}
