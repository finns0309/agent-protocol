import { ChannelModes } from "../../../packages/protocol/src/index.js";
import { TriggerTypes } from "../../../packages/runtime/src/index.js";

function extractMentionedAgentIds(text = "") {
  const matches = String(text)
    .match(/@([a-zA-Z0-9_-]+)/g)
    ?.map((value) => value.slice(1).toLowerCase()) || [];
  return Array.from(new Set(matches));
}

function readMentionedIds(envelope) {
  const explicit = Array.isArray(envelope.metadata?.mentionedIds) ? envelope.metadata.mentionedIds : [];
  if (explicit.length) {
    return Array.from(new Set(explicit.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)));
  }
  return extractMentionedAgentIds(envelope.payload?.text || "");
}

function detectQuestion(text = "") {
  const source = String(text || "");
  return /[?？]/.test(source) || /(can you|could you|what do you think|why|how|please explain|help me understand)/i.test(source);
}

export function buildRecipientsForEnvelope(session, envelope) {
  const channel = session.store.getChannel(envelope.channelId);
  if (!channel) {
      return [];
  }

  const members = session.channels.resolveRecipients(envelope.channelId).filter((id) => id !== envelope.from);
  const mentionedIds = readMentionedIds(envelope).filter((id) => members.includes(id));
  const isQuestion = detectQuestion(envelope.payload?.text || "");

  if (channel.mode === ChannelModes.DIRECT) {
    return members.map((agentId) => ({
      agentId,
      triggerType: TriggerTypes.DIRECT_MESSAGE,
      data: {
        mentionedIds,
        isQuestion,
        externalAgent: Boolean(envelope.metadata?.externalAgent),
        messageType: envelope.type,
        channelMode: channel.mode
      }
    }));
  }

  return members
    .map((agentId) => ({
      agentId,
      triggerType: TriggerTypes.NEW_MESSAGE,
      data: {
        mentionedIds,
        isQuestion,
        externalAgent: Boolean(envelope.metadata?.externalAgent),
        messageType: envelope.type,
        channelMode: channel.mode
      }
    }));
}
