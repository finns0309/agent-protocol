#!/usr/bin/env node
/**
 * OpenClaw connector for Polis.
 *
 * The connector is responsible for register/stream/inbox/action/ack.
 * OpenClaw itself is only asked to decide what final action to take.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  createExternalConnector,
  readExternalProfile
} from "./external-connector.js";

const execFileAsync = promisify(execFile);

const BASE_URL = process.env.AGENT_SERVER_URL || "http://127.0.0.1:4190";
const AGENT_ID = process.env.OPENCLAW_AGENT_ID || "finn-openclaw";
const DISPLAY_NAME = process.env.OPENCLAW_DISPLAY_NAME || "Finn OpenClaw";
const ROLE = process.env.OPENCLAW_ROLE || "external_agent";
const DIRECTIVE =
  process.env.OPENCLAW_DIRECTIVE ||
  "After receiving a Polis trigger, decide whether to read more context, whether to respond, and when to stay silent.";
const MODEL = process.env.OPENCLAW_MODEL || "openclaw";
const OPENCLAW_AGENT = process.env.OPENCLAW_AGENT || "main";
const CHANNEL_MESSAGE_LIMIT = Number(process.env.OPENCLAW_CHANNEL_LIMIT || 12);
const START_CHANNELS = String(process.env.OPENCLAW_JOIN_CHANNELS || "general")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const CONNECTOR_PROFILE = readExternalProfile("OPENCLAW", {
  connectorType: "openclaw_sidecar",
  wakeCapabilities: ["event", "poll"],
  executionModes: ["isolated_session", "owner_review"],
  defaultMode: "isolated_session",
  decisionMode: "autonomous",
  notes: "OpenClaw sidecar connector that receives Polis triggers over SSE."
});

function parseOpenClawJson(stdout) {
  const firstBrace = stdout.indexOf("{");
  if (firstBrace === -1) {
    throw new Error("OpenClaw output did not contain JSON.");
  }
  return JSON.parse(stdout.slice(firstBrace));
}

async function runOpenClaw(message) {
  const { stdout } = await execFileAsync("openclaw", [
    "agent",
    "--agent",
    OPENCLAW_AGENT,
    "--local",
    "--json",
    "--message",
    message
  ]);

  const result = parseOpenClawJson(stdout);
  const text = result?.payloads?.map((payload) => payload?.text || "").filter(Boolean).join("\n").trim();
  if (!text) {
    throw new Error("OpenClaw returned no text payload.");
  }
  return text;
}

function buildDecisionPrompt({ trigger, context, buildDecisionBundle, stringifyDecisionBundle }) {
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
    "You connect to Polis through a sidecar connector.",
    "The connector already handles register / SSE / inbox / query / action / ack.",
    "Your job is to decide the final action from the JSON bundle below.",
    "",
    "Working principles:",
    "- Polis is a wake/query/action surface, not a chat-prompt transport.",
    "- If you have no new value to add, return pass.",
    "- If you do respond, prioritize information-dense and actionable content.",
    "- For lightweight acknowledgment, welcome, acceptance, or reminders, prefer react instead of sending a full message.",
    "- You may judge based on the trigger, recent channel messages, actor social state, and collaboration snapshot.",
    "- Return strict JSON only. Do not explain.",
    "",
    "Allowed action examples:",
    '- {"type":"send_message","channelId":"general","messageType":"NEGOTIATE","text":"...","reason":"..."}',
    '- {"type":"react","targetMessageId":"envelope-12","reactionType":"endorse","reason":"..."}',
    '- {"type":"send_message","channelId":"general","messageType":"DELIVER","content":[{"type":"markdown","text":"## Plan\\n- ..."}],"reason":"..."}',
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

function normalizeFinalAction(rawText) {
  const firstBrace = rawText.indexOf("{");
  if (firstBrace === -1) {
    throw new Error("OpenClaw did not return JSON.");
  }

  const action = JSON.parse(rawText.slice(firstBrace));
  const type = action.type || action.action || "";
  if (!type) {
    throw new Error("Final action is missing type.");
  }
  return action;
}

async function decideTrigger({ trigger, context, buildDecisionBundle, stringifyDecisionBundle }) {
  const prompt = buildDecisionPrompt({
    trigger,
    context,
    buildDecisionBundle,
    stringifyDecisionBundle
  });
  const rawText = await runOpenClaw(prompt);
  return normalizeFinalAction(rawText);
}

async function main() {
  const connector = createExternalConnector({
    baseUrl: BASE_URL,
    agentId: AGENT_ID,
    displayName: DISPLAY_NAME,
    role: ROLE,
    directive: DIRECTIVE,
    origin: "openclaw-connector",
    model: MODEL,
    startChannels: START_CHANNELS,
    channelMessageLimit: CHANNEL_MESSAGE_LIMIT,
    connectorProfile: CONNECTOR_PROFILE,
    initialToken: process.env.OPENCLAW_TOKEN || "",
    loggerPrefix: "[openclaw-connector]",
    extraMetadata: {
      source: "openclaw_sse_bridge"
    },
    decide: decideTrigger
  });

  await connector.start();
}

process.on("SIGINT", () => {
  console.log("\n[openclaw-connector] shutting down");
  process.exit(0);
});

main().catch((error) => {
  console.error("[openclaw-connector] fatal:", error.stack || error.message || String(error));
  process.exit(1);
});
