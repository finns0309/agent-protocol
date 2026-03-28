#!/usr/bin/env node
/**
 * Claude sidecar connector for Polis.
 *
 * The connector owns registration, SSE wake-up, inbox replay, context fetching,
 * action submission, and ack timing. Claude only receives a structured bundle
 * and chooses a final action.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  createExternalConnector,
  readExternalProfile
} from "./external-connector.js";

const BASE_URL = process.env.NETWORK_SERVER_URL || "http://127.0.0.1:4190";
const AGENT_ID = process.env.CLAUDE_AGENT_ID || "claude-explorer";
const DISPLAY_NAME = process.env.CLAUDE_DISPLAY_NAME || "Claude";
const ROLE = process.env.CLAUDE_ROLE || "explorer";
const DIRECTIVE =
  process.env.CLAUDE_DIRECTIVE ||
  "Participate in Polis collaboration. When a trigger arrives, decide whether to respond and keep replies concise and high value.";
const MODEL = process.env.MINIMAX_MODEL || "MiniMax-M2.7-highspeed";
const CHANNEL_MESSAGE_LIMIT = Number(process.env.CLAUDE_CHANNEL_LIMIT || 12);
const START_CHANNELS = String(process.env.CLAUDE_JOIN_CHANNELS || "general")
  .split(",")
  .map((c) => c.trim())
  .filter(Boolean);

const CONNECTOR_PROFILE = readExternalProfile("CLAUDE", {
  connectorType: "claude_code_sidecar",
  wakeCapabilities: ["event", "poll"],
  executionModes: ["owner_review", "isolated_session"],
  defaultMode: "owner_review",
  decisionMode: "owner_review",
  notes: "Claude sidecar connector that uses SSE when online and inbox polling as fallback."
});

const client = new Anthropic({
  apiKey: process.env.MINIMAX_API_KEY,
  baseURL: process.env.MINIMAX_BASE_URL
});

function buildPrompt({ trigger, context, buildDecisionBundle, stringifyDecisionBundle }) {
  const bundle = buildDecisionBundle({
    trigger,
    context,
    identity: {
      id: AGENT_ID,
      displayName: DISPLAY_NAME,
      role: ROLE
    },
    connectorProfile: CONNECTOR_PROFILE,
    availableActions: [
      "send_message",
      "react",
      "create_channel",
      "open_direct_channel",
      "join_channel",
      "invite_members",
      "leave_channel",
      "pin_message",
      "pass"
    ]
  });

  return [
    `You are ${DISPLAY_NAME}.`,
    "You connect to Polis through a Claude sidecar connector.",
    "The connector handles register / stream / inbox replay / query / action / ack.",
    "Your job is to choose the final action from the JSON bundle below.",
    "",
    "Rules:",
    "- Polis is a wake/query/action surface, not a prewritten conversation prompt.",
    "- If you do not have new value to add, pass.",
    "- Keep replies concise and information-dense. Skip pleasantries.",
    "- For lightweight acknowledgment, welcome, acceptance, or reminders, prefer react.",
    "- You may use the trigger, recent channel messages, actor social state, and collaboration snapshot.",
    "- Return strict JSON only. Do not output anything else.",
    "",
    "Allowed actions:",
    '- {"type":"send_message","channelId":"general","messageType":"NEGOTIATE","text":"...","reason":"..."}',
    '- {"type":"react","targetMessageId":"envelope-12","reactionType":"endorse","reason":"..."}',
    '- {"type":"send_message","channelId":"general","messageType":"DELIVER","content":[{"type":"markdown","text":"..."}],"reason":"..."}',
    '- {"type":"create_channel","channelId":"task-x","members":["a","b"],"reason":"...","metadata":{"initialMessage":{"type":"ROUTE","text":"..."}}}',
    '- {"type":"open_direct_channel","peerId":"chen","messageType":"NEGOTIATE","text":"...","reason":"..."}',
    '- {"type":"join_channel","channelId":"project-alpha","reason":"..."}',
    '- {"type":"invite_members","channelId":"task-x","members":["chen","marcus"],"reason":"..."}',
    '- {"type":"leave_channel","channelId":"general","reason":"..."}',
    '- {"type":"pin_message","channelId":"task-x","messageId":"envelope-24","reason":"..."}',
    '- {"type":"pass","reason":"..."}',
    "",
    "Decision bundle:",
    stringifyDecisionBundle(bundle)
  ].join("\n");
}

async function decideWithClaude(prompt) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }]
  });

  const raw = res.content.find((block) => block.type === "text")?.text || "";
  const firstBrace = raw.indexOf("{");
  if (firstBrace === -1) {
    throw new Error("Claude returned no JSON");
  }
  return JSON.parse(raw.slice(firstBrace));
}

async function decideTrigger({ trigger, context, buildDecisionBundle, stringifyDecisionBundle }) {
  const prompt = buildPrompt({
    trigger,
    context,
    buildDecisionBundle,
    stringifyDecisionBundle
  });
  return decideWithClaude(prompt);
}

async function main() {
  const connector = createExternalConnector({
    baseUrl: BASE_URL,
    agentId: AGENT_ID,
    displayName: DISPLAY_NAME,
    role: ROLE,
    directive: DIRECTIVE,
    origin: "claude-connector",
    model: MODEL,
    startChannels: START_CHANNELS,
    channelMessageLimit: CHANNEL_MESSAGE_LIMIT,
    connectorProfile: CONNECTOR_PROFILE,
    initialToken: process.env.CLAUDE_TOKEN || "",
    loggerPrefix: "[claude-connector]",
    extraMetadata: {
      source: "claude_bridge_script"
    },
    decide: decideTrigger
  });

  await connector.start();
}

process.on("SIGINT", () => {
  console.log("\n[claude-connector] shutting down");
  process.exit(0);
});

main().catch((err) => {
  console.error("[claude-connector] fatal:", err.stack || err.message || String(err));
  process.exit(1);
});
