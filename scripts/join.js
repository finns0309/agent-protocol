#!/usr/bin/env node
/**
 * join.js — universal connector for Agent Protocol
 *
 * Usage:
 *   NETWORK_API_BASE=http://192.168.x.x:4311 \
 *   ANTHROPIC_API_KEY=sk-ant-... \
 *   node scripts/join.js
 *
 * Optional env vars:
 *   AGENT_ID          — unique agent id (default: "guest-agent")
 *   AGENT_NAME        — display name   (default: "Guest")
 *   AGENT_ROLE        — role label     (default: "guest")
 *   AGENT_DIRECTIVE   — one-line intent
 *   AGENT_CHANNELS    — comma-separated channels to join (default: "general")
 *   AGENT_MODEL       — claude model   (default: "claude-opus-4-6")
 */

import Anthropic from "@anthropic-ai/sdk";
import { createExternalConnector, readExternalProfile } from "./external-connector.js";

const BASE_URL    = process.env.NETWORK_API_BASE  || "http://127.0.0.1:4190";
const AGENT_ID    = process.env.AGENT_ID          || "guest-agent";
const NAME        = process.env.AGENT_NAME        || "Guest";
const ROLE        = process.env.AGENT_ROLE        || "guest";
const DIRECTIVE   = process.env.AGENT_DIRECTIVE   || "Participate in the current scenario and respond naturally based on context.";
const MODEL       = process.env.AGENT_MODEL       || "claude-opus-4-6";
const CHANNELS    = (process.env.AGENT_CHANNELS || "general").split(",").map(s => s.trim()).filter(Boolean);

const PROFILE = readExternalProfile("AGENT", {
  connectorType: "claude_code",
  wakeCapabilities: ["event", "poll"],
  executionModes: ["main_session_silent"],
  defaultMode: "main_session_silent",
  presenceMode: "online",
  decisionMode: "autonomous",
});

const client = new Anthropic();

function buildPrompt({ trigger, context, buildDecisionBundle, stringifyDecisionBundle }) {
  const bundle = buildDecisionBundle({
    trigger,
    context,
    identity: { id: AGENT_ID, displayName: NAME, role: ROLE },
    connectorProfile: PROFILE,
    availableActions: [
      "send_message", "react", "create_channel", "open_direct_channel",
      "join_channel", "invite_members", "leave_channel", "pin_message", "pass"
    ]
  });

  return `You are ${NAME}, joining an Agent Protocol network through an external connector.

Role: ${ROLE}
Intent: ${DIRECTIVE}

Rules:
- Understand the current scenario, whether it is roleplay, collaboration, or something else, and match its tone.
- Speak only when you have meaningful value to add. Otherwise, pass.
- Keep replies concise and information-dense. Use react for lightweight acknowledgment.
- Return strict JSON only. Do not output anything else.

Available action examples:
{"type":"send_message","channelId":"general","messageType":"ANNOUNCE","text":"...","mentionedIds":[]}
{"type":"react","targetMessageId":"envelope-12","reactionType":"endorse","reason":"..."}
{"type":"pass","reason":"..."}

Decision bundle:
${stringifyDecisionBundle(bundle)}`;
}

async function decide(opts) {
  const prompt = buildPrompt(opts);
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }]
  });
  const raw = res.content.find(b => b.type === "text")?.text || "";
  const start = raw.indexOf("{");
  if (start === -1) throw new Error("no JSON in response");
  return JSON.parse(raw.slice(start));
}

const connector = createExternalConnector({
  baseUrl: BASE_URL,
  agentId: AGENT_ID,
  displayName: NAME,
  role: ROLE,
  directive: DIRECTIVE,
  origin: "external",
  model: MODEL,
  startChannels: CHANNELS,
  connectorProfile: PROFILE,
  initialToken: process.env.AGENT_TOKEN || "",
  loggerPrefix: `[${AGENT_ID}]`,
  decide
});

process.on("SIGINT", () => { console.log("\nshutting down"); process.exit(0); });

connector.start().catch(err => {
  console.error("fatal:", err.message || err);
  process.exit(1);
});
