import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const options = {
    openclawAgent: "main",
    identityId: "openclaw-finn",
    displayName: "Finn OpenClaw",
    role: "operator",
    channelId: "general",
    messageType: "REQUEST",
    baseUrl: process.env.HUMAN_UI_BASE_URL || "http://127.0.0.1:4181",
    origin: "external",
    model: "openclaw"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--instruction") {
      options.instruction = next;
      index += 1;
    } else if (arg === "--text") {
      options.text = next;
      index += 1;
    } else if (arg === "--openclaw-agent") {
      options.openclawAgent = next;
      index += 1;
    } else if (arg === "--identity-id") {
      options.identityId = next;
      index += 1;
    } else if (arg === "--display-name") {
      options.displayName = next;
      index += 1;
    } else if (arg === "--role") {
      options.role = next;
      index += 1;
    } else if (arg === "--channel") {
      options.channelId = next;
      index += 1;
    } else if (arg === "--message-type") {
      options.messageType = next;
      index += 1;
    } else if (arg === "--base-url") {
      options.baseUrl = next;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/openclaw-bridge.js --instruction "Ask OpenClaw to give the team one concise suggestion"

Options:
  --instruction      Ask local OpenClaw to generate the message text
  --text             Bypass OpenClaw and inject literal text directly
  --openclaw-agent   OpenClaw agent id (default: main)
  --identity-id      Identity id inside the protocol server (default: openclaw-finn)
  --display-name     Display name inside the protocol server (default: Finn OpenClaw)
  --role             Role inside the protocol server (default: operator)
  --channel          Target channel id (default: general)
  --message-type     ANNOUNCE | REQUEST | NEGOTIATE | REACT | SYSTEM
  --base-url         Live observer base URL (default: http://127.0.0.1:4181)
`.trim());
}

function extractJson(stdout) {
  const firstBrace = stdout.indexOf("{");
  if (firstBrace === -1) {
    throw new Error("OpenClaw output did not contain JSON.");
  }

  return JSON.parse(stdout.slice(firstBrace));
}

async function generateTextWithOpenClaw({ openclawAgent, instruction }) {
  const { stdout } = await execFileAsync("openclaw", [
    "agent",
    "--agent",
    openclawAgent,
    "--local",
    "--json",
    "--message",
    instruction
  ]);

  const result = extractJson(stdout);
  const text = result?.payloads?.map((payload) => payload?.text || "").filter(Boolean).join("\n").trim();
  if (!text) {
    throw new Error("OpenClaw returned no text payload.");
  }

  return {
    text,
    openclawResult: result
  };
}

async function postExternalMessage({
  baseUrl,
  identityId,
  displayName,
  role,
  channelId,
  messageType,
  origin,
  model,
  text,
  openclawResult
}) {
  const response = await fetch(`${baseUrl}/api/external/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      agentId: identityId,
      displayName,
      role,
      channelId,
      messageType,
      text,
      origin,
      model,
      metadata: {
        source: "openclaw_bridge_script",
        openclawSessionId: openclawResult?.meta?.agentMeta?.sessionId || ""
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Bridge request failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || (!options.instruction && !options.text)) {
    printHelp();
    process.exit(options.help ? 0 : 1);
  }

  const generated = options.text
    ? { text: options.text, openclawResult: null }
    : await generateTextWithOpenClaw({
        openclawAgent: options.openclawAgent,
        instruction: options.instruction
      });

  const result = await postExternalMessage({
    baseUrl: options.baseUrl,
    identityId: options.identityId,
    displayName: options.displayName,
    role: options.role,
    channelId: options.channelId,
    messageType: options.messageType,
    origin: options.origin,
    model: options.model,
    text: generated.text,
    openclawResult: generated.openclawResult
  });

  console.log(
    JSON.stringify(
      {
        injectedText: generated.text,
        envelopeId: result?.envelope?.id,
        channelId: result?.envelope?.channelId,
        identity: result?.identity?.id
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
