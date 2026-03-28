import { createFinalAction, FinalActionTypes } from "../action.js";
import { LLMAdapter } from "./adapter.js";

const requestWindowTimestamps = [];
const successWindowTimestamps = [];
const errorWindowTimestamps = [];
const rateLimitWindowTimestamps = [];
let inFlightRequestCount = 0;
let lastPressureLogAt = 0;

function assertFetch() {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available in this runtime.");
  }
}

function extractTextBlocks(content = []) {
  return content
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function extractToolUses(content = []) {
  return content.filter((block) => block?.type === "tool_use");
}

function safeParseFinalAction(rawText) {
  try {
    return createFinalAction(JSON.parse(rawText));
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      return createFinalAction(JSON.parse(match[0]));
    } catch {
      return null;
    }
  }
}

function normalizeToolSchema(tool) {
  return {
    name: tool.name,
    description: tool.description || "",
    input_schema: tool.inputSchema || {
      type: "object",
      properties: {}
    }
  };
}

function createToolResultBlock(toolUseId, result) {
  return {
    type: "tool_result",
    tool_use_id: toolUseId,
    content: JSON.stringify(result)
  };
}

function createActionPhaseReminderBlock() {
  return {
    type: "text",
    text: [
      "Tool results have been returned.",
      "If you now have enough information, stop calling tools and return a final action object that can be parsed with JSON.parse.",
      "Do not output natural-language explanation or code fences.",
      "send_message, react, create_channel, open_direct_channel, join_channel, invite_members, leave_channel, pin_message, and pass are final action types, not tool names."
    ].join(" ")
  };
}

function markRequestStarted() {
  const now = Date.now();
  requestWindowTimestamps.push(now);
  pruneTimestampWindow(requestWindowTimestamps, now);
  inFlightRequestCount += 1;
  return now;
}

function markRequestFinished() {
  inFlightRequestCount = Math.max(0, inFlightRequestCount - 1);
}

function snapshotRequestPressure() {
  const now = Date.now();
  pruneTimestampWindow(requestWindowTimestamps, now);
  pruneTimestampWindow(successWindowTimestamps, now);
  pruneTimestampWindow(errorWindowTimestamps, now);
  pruneTimestampWindow(rateLimitWindowTimestamps, now);
  return {
    inFlight: inFlightRequestCount,
    requestsLastMinute: requestWindowTimestamps.length,
    successLastMinute: successWindowTimestamps.length,
    errorLastMinute: errorWindowTimestamps.length,
    rateLimitLastMinute: rateLimitWindowTimestamps.length,
    requestsLast10Seconds: countRecent(requestWindowTimestamps, now, 10_000)
  };
}

function pruneTimestampWindow(timestamps, now = Date.now(), windowMs = 60_000) {
  while (timestamps.length && now - timestamps[0] > windowMs) {
    timestamps.shift();
  }
}

function countRecent(timestamps, now = Date.now(), windowMs = 60_000) {
  pruneTimestampWindow(timestamps, now, Math.max(windowMs, 60_000));
  return timestamps.filter((timestamp) => now - timestamp <= windowMs).length;
}

function recordOutcome(kind) {
  const now = Date.now();
  if (kind === "success") {
    successWindowTimestamps.push(now);
  } else if (kind === "error") {
    errorWindowTimestamps.push(now);
  } else if (kind === "rate_limit") {
    errorWindowTimestamps.push(now);
    rateLimitWindowTimestamps.push(now);
  }
}

function maybeLogRequestPressure({ provider, model, reason }) {
  const now = Date.now();
  const intervalMs = reason === "rate_limit" ? 0 : 15_000;
  if (now - lastPressureLogAt < intervalMs) {
    return;
  }

  lastPressureLogAt = now;
  const pressure = snapshotRequestPressure();
  console.log(
    `[llm-pressure] provider=${provider} model=${model} reason=${reason} inflight=${pressure.inFlight} req_10s=${pressure.requestsLast10Seconds} req_1m=${pressure.requestsLastMinute} ok_1m=${pressure.successLastMinute} err_1m=${pressure.errorLastMinute} rate_limit_1m=${pressure.rateLimitLastMinute}`
  );
}

function readRateLimitHeaders(response) {
  return {
    retryAfter: response.headers.get("retry-after") || "",
    limitRequests: response.headers.get("x-ratelimit-limit-requests") || response.headers.get("x-ratelimit-limit") || "",
    remainingRequests: response.headers.get("x-ratelimit-remaining-requests") || response.headers.get("x-ratelimit-remaining") || "",
    resetRequests: response.headers.get("x-ratelimit-reset-requests") || response.headers.get("x-ratelimit-reset") || "",
    requestId: response.headers.get("x-request-id") || response.headers.get("request-id") || ""
  };
}

export class AnthropicCompatibleToolUseAdapter extends LLMAdapter {
  constructor({
    provider = "anthropic-compatible",
    apiKey,
    baseUrl,
    model,
    defaultHeaders = {},
    temperature = 1,
    maxTokens = 1200,
    safetyMaxIterations = 128
  } = {}) {
    super();
    this.provider = provider;
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl || "").replace(/\/$/, "");
    this.model = model;
    this.defaultHeaders = defaultHeaders;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
    this.safetyMaxIterations = safetyMaxIterations;
  }

  ensureConfigured() {
    if (!this.apiKey) {
      throw new Error(`${this.provider} adapter is missing an API key.`);
    }

    if (!this.baseUrl) {
      throw new Error(`${this.provider} adapter is missing a base URL.`);
    }

    if (!this.model) {
      throw new Error(`${this.provider} adapter is missing a model name.`);
    }
  }

  async respond({ prompt, trigger, tools }) {
    assertFetch();
    this.ensureConfigured();

    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt.user
          }
        ]
      }
    ];

    const toolDefinitions = tools.map(normalizeToolSchema);
    const aggregatedUsage = {
      inputTokens: 0,
      outputTokens: 0
    };
    const transcript = [];

    for (let iteration = 0; iteration < this.safetyMaxIterations; iteration += 1) {
      const payload = {
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: [
          prompt.system,
          "You may call tools proactively when needed.",
          "Once you have enough information, output a strict JSON final action.",
          "The final action must be one of: send_message / react / create_channel / open_direct_channel / join_channel / invite_members / leave_channel / pin_message / pass.",
          "These final actions are not tool names. They belong in the type field of the final JSON object you return.",
          "If you choose pass, you must still return JSON."
        ].join(" "),
        messages,
        tools: toolDefinitions,
        tool_choice: {
          type: "auto"
        }
      };

      const requestStartedAt = markRequestStarted();
      let response;
      try {
        response = await fetch(`${this.baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
            ...this.defaultHeaders
          },
          body: JSON.stringify(payload)
        });
      } finally {
        markRequestFinished();
      }

      if (!response.ok) {
        const errorText = await response.text();
        recordOutcome(response.status === 429 ? "rate_limit" : "error");
        maybeLogRequestPressure({
          provider: this.provider,
          model: this.model,
          reason: response.status === 429 ? "rate_limit" : `http_${response.status}`
        });
        const pressure = snapshotRequestPressure();
        const headers = readRateLimitHeaders(response);
        throw new Error(
          `${this.provider} request failed (${response.status} ${response.statusText}) for ${trigger?.id || "unknown-trigger"}: ${errorText}; local_in_flight=${pressure.inFlight}; local_rpm_1m=${pressure.requestsLastMinute}; retry_after=${headers.retryAfter || "n/a"}; rate_limit=${headers.limitRequests || "n/a"}; rate_remaining=${headers.remainingRequests || "n/a"}; rate_reset=${headers.resetRequests || "n/a"}; request_id=${headers.requestId || "n/a"}; latency_ms=${Date.now() - requestStartedAt}`
        );
      }

      const json = await response.json();
      recordOutcome("success");
      maybeLogRequestPressure({
        provider: this.provider,
        model: this.model,
        reason: "success"
      });
      aggregatedUsage.inputTokens += json.usage?.input_tokens ?? 0;
      aggregatedUsage.outputTokens += json.usage?.output_tokens ?? 0;
      transcript.push(json);

      messages.push({
        role: "assistant",
        content: json.content
      });

      const toolUses = extractToolUses(json.content);
      if (toolUses.length === 0) {
        const rawText = extractTextBlocks(json.content);
        const finalAction =
          safeParseFinalAction(rawText) ||
          createFinalAction({
            type: FinalActionTypes.PASS,
            reason: "The model did not return a parseable JSON final action.",
            metadata: {
              rawText
            }
          });

        return {
          provider: this.provider,
          model: json.model || this.model,
          rawText,
          finalAction,
          usage: aggregatedUsage,
          rawResponse: {
            transcript
          }
        };
      }

      const toolResults = [];
      for (const toolUse of toolUses) {
        const tool = tools.find((candidate) => candidate.name === toolUse.name);
        if (!tool) {
          toolResults.push(
            createToolResultBlock(toolUse.id, {
              error: `Unknown tool: ${toolUse.name}`
            })
          );
          continue;
        }

        const result = await tool.execute(toolUse.input || {});
        toolResults.push(createToolResultBlock(toolUse.id, result));
      }

      messages.push({
        role: "user",
        content: [...toolResults, createActionPhaseReminderBlock()]
      });
    }

    return {
      provider: this.provider,
      model: this.model,
      rawText: "",
      finalAction: createFinalAction({
        type: FinalActionTypes.PASS,
        reason: `Stopped after reaching the safety limit of ${this.safetyMaxIterations} reasoning iterations.`
      }),
      usage: aggregatedUsage,
      rawResponse: {
        transcript
      }
    };
  }
}
