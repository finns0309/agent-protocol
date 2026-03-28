import { spawn } from "node:child_process";

export function parseCsv(value, fallback = []) {
  const source = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return source.length ? source : fallback;
}

function normalizeOptionalNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function readExternalProfile(prefix, defaults = {}) {
  const wakeCapabilities = parseCsv(
    process.env[`${prefix}_WAKE_CAPABILITIES`],
    defaults.wakeCapabilities || ["event", "poll"]
  );
  const executionModes = parseCsv(
    process.env[`${prefix}_EXECUTION_MODES`],
    defaults.executionModes || ["owner_review"]
  );

  return {
    connectorType: process.env[`${prefix}_CONNECTOR_TYPE`] || defaults.connectorType || "",
    wakeCapabilities,
    executionModes,
    defaultMode:
      process.env[`${prefix}_DEFAULT_MODE`] ||
      defaults.defaultMode ||
      executionModes[0] ||
      "owner_review",
    presenceMode: process.env[`${prefix}_PRESENCE_MODE`] || defaults.presenceMode || "",
    decisionMode: process.env[`${prefix}_DECISION_MODE`] || defaults.decisionMode || "",
    heartbeatMinutes: normalizeOptionalNumber(process.env[`${prefix}_HEARTBEAT_MINUTES`] || defaults.heartbeatMinutes),
    notes: process.env[`${prefix}_CONNECTOR_NOTES`] || defaults.notes || ""
  };
}

function parseSseFrame(frame) {
  let event = "";
  let data = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      data += line.slice(5).trim();
    }
  }
  if (!event) {
    return null;
  }
  try {
    return { event, data: data ? JSON.parse(data) : null };
  } catch {
    return { event, data: null };
  }
}

function normalizeDecisionResult(result) {
  if (!result) {
    return { action: { type: "pass", reason: "connector_no_action" } };
  }
  if (result.action || result.ack === false || result.status === "deferred") {
    return result;
  }
  if (result.type) {
    return { action: result };
  }
  throw new Error("Decision result must be an action object or { action, ... } wrapper.");
}

export function buildDecisionBundle({
  trigger,
  context,
  identity,
  connectorProfile,
  availableActions
}) {
  return {
    connector: {
      agentId: identity.id,
      displayName: identity.displayName,
      role: identity.role,
      externalProfile: connectorProfile
    },
    trigger,
    context,
    contract: {
      queryModel: "Polis is a wake/query/action surface, not a prompt transport.",
      allowedActions: availableActions
    }
  };
}

export function stringifyDecisionBundle(bundle) {
  return JSON.stringify(bundle, null, 2);
}

export function createExternalConnector({
  baseUrl,
  agentId,
  displayName,
  role,
  directive,
  origin,
  model,
  startChannels = [],
  channelMessageLimit = 12,
  connectorProfile = {},
  initialToken = "",
  startupInboxLimit = 100,
  loggerPrefix = "[connector]",
  extraMetadata = {},
  decide
}) {
  let authToken = initialToken;
  const completedTriggerIds = new Set();
  const queuedTriggerIds = new Set();
  const triggerQueue = [];
  let processing = false;

  function log(...args) {
    console.log(loggerPrefix, ...args);
  }

  async function getJson(path) {
    const response = await fetch(`${baseUrl}${path}`);
    if (!response.ok) {
      throw new Error(`GET ${path} failed: ${response.status}`);
    }
    return response.json();
  }

  async function postJson(path, body) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`POST ${path} failed: ${response.status} ${text}`);
    }
    return response.json();
  }

  async function register() {
    const response = await postJson("/api/agents/register", {
      agentId,
      displayName,
      role,
      directive,
      origin,
      model,
      metadata: {
        ...extraMetadata,
        externalProfile: connectorProfile
      },
      token: authToken
    });
    if (!response.ok) {
      throw new Error(`register failed: ${JSON.stringify(response)}`);
    }
    authToken = response.authToken;
    return response;
  }

  async function ensureMemberships() {
    for (const channelId of startChannels) {
      await postJson("/api/actions", {
        agentId,
        token: authToken,
        action: {
          type: "join_channel",
          channelId
        }
      });
      log(`joined #${channelId}`);
    }
  }

  async function listInbox(limit = startupInboxLimit) {
    return getJson(
      `/api/inbox?agentId=${encodeURIComponent(agentId)}&token=${encodeURIComponent(authToken)}&limit=${limit}`
    );
  }

  async function ackTrigger(triggerId) {
    await postJson("/api/inbox/ack", {
      agentId,
      token: authToken,
      triggerIds: [triggerId]
    });
    completedTriggerIds.add(triggerId);
    queuedTriggerIds.delete(triggerId);
  }

  async function submitAction(action) {
    return postJson("/api/actions", {
      agentId,
      token: authToken,
      action
    });
  }

  async function fetchTriggerContext(trigger) {
    const actorId = trigger.actorId ? encodeURIComponent(trigger.actorId) : "";
    const channelId = trigger.channelId ? encodeURIComponent(trigger.channelId) : "";
    const viewerQuery = `agentId=${encodeURIComponent(agentId)}&token=${encodeURIComponent(authToken)}`;

    const [channelsRes, actorRes, actorSocialRes, actorChannelsRes, collaborationRes, messagesRes] = await Promise.all([
      getJson(`/api/channels?${viewerQuery}`),
      trigger.actorId ? getJson(`/api/agents/${actorId}`) : Promise.resolve({ identity: null }),
      trigger.actorId ? getJson(`/api/agents/${actorId}/social`) : Promise.resolve({ social: null }),
      trigger.actorId ? getJson(`/api/agents/${actorId}/channels`) : Promise.resolve({ channels: [] }),
      trigger.actorId
        ? getJson(`/api/agents/${actorId}/collaboration?agentId=${encodeURIComponent(agentId)}`)
        : Promise.resolve({ collaboration: null }),
      trigger.channelId
        ? getJson(`/api/channels/${channelId}/messages?${viewerQuery}&limit=${channelMessageLimit}`)
        : Promise.resolve({ messages: [] })
    ]);

    return {
      viewer: {
        agentId,
        connectorProfile
      },
      visibleChannels: channelsRes.channels || [],
      actor: {
        identity: actorRes.identity || null,
        social: actorSocialRes.social || null,
        channels: actorChannelsRes.channels || []
      },
      collaboration: collaborationRes.collaboration || null,
      channel: {
        id: trigger.channelId || "",
        messages: messagesRes.messages || []
      }
    };
  }

  function enqueueTrigger(trigger) {
    if (!trigger?.id || completedTriggerIds.has(trigger.id) || queuedTriggerIds.has(trigger.id)) {
      return false;
    }
    queuedTriggerIds.add(trigger.id);
    triggerQueue.push(trigger);
    processQueue().catch((error) => {
      console.error(loggerPrefix, "queue failure:", error.stack || error.message || String(error));
    });
    return true;
  }

  async function processTrigger(trigger) {
    const context = await fetchTriggerContext(trigger);
    const decision = normalizeDecisionResult(
      await decide({
        trigger,
        context,
        authToken,
        connectorProfile,
        submitAction,
        ackTrigger,
        buildDecisionBundle,
        stringifyDecisionBundle
      })
    );

    if (decision.status === "deferred") {
      queuedTriggerIds.delete(trigger.id);
      log(`deferred ${trigger.id}: ${decision.reason || ""}`);
      return;
    }

    const action = decision.action || { type: "pass", reason: "connector_default_pass" };
    if (action.type !== "pass") {
      const result = await submitAction(action);
      log(`submitted ${action.type} for ${trigger.id}:`, JSON.stringify(result.execution || result, null, 2));
    } else {
      log(`pass for ${trigger.id}: ${action.reason || ""}`);
    }

    if (decision.ack !== false) {
      await ackTrigger(trigger.id);
      return;
    }

    queuedTriggerIds.delete(trigger.id);
  }

  async function processQueue() {
    if (processing) {
      return;
    }
    processing = true;
    while (triggerQueue.length) {
      const trigger = triggerQueue.shift();
      try {
        await processTrigger(trigger);
      } catch (error) {
        queuedTriggerIds.delete(trigger.id);
        console.error(loggerPrefix, `trigger handling failed for ${trigger.id}:`, error.stack || error.message || String(error));
      }
    }
    processing = false;
  }

  async function drainInbox(limit = startupInboxLimit) {
    const inbox = await listInbox(limit);
    for (const trigger of inbox.triggers || []) {
      enqueueTrigger(trigger);
    }
    return inbox.triggers || [];
  }

  function connectStream() {
    const url = `${baseUrl}/api/events/stream?agentId=${encodeURIComponent(agentId)}&token=${encodeURIComponent(authToken)}`;
    log(`connecting SSE -> ${url}`);

    const proc = spawn("curl", ["-s", "-N", "-H", "Accept: text/event-stream", url], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let buffer = "";

    proc.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const frames = buffer.split("\n\n");
      buffer = frames.pop() || "";

      for (const frame of frames) {
        const parsed = parseSseFrame(frame);
        if (!parsed) {
          continue;
        }

        if (parsed.event === "ready") {
          log("stream ready:", JSON.stringify(parsed.data));
          continue;
        }

        if (parsed.event === "trigger" && parsed.data) {
          enqueueTrigger(parsed.data);
        }
      }
    });

    proc.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8").trim();
      if (text) {
        console.error(loggerPrefix, "stderr:", text);
      }
    });

    proc.on("close", () => {
      log("stream closed, reconnecting in 3s...");
      setTimeout(() => {
        drainInbox().catch((error) => {
          console.error(loggerPrefix, "inbox refresh failed:", error.stack || error.message || String(error));
        });
        connectStream();
      }, 3000);
    });
  }

  async function start() {
    const registration = await register();
    log(`registered: ${registration.identity.id} token: ${registration.authToken}`);
    await ensureMemberships();
    await drainInbox();
    connectStream();
    return registration;
  }

  return {
    start,
    register,
    ensureMemberships,
    drainInbox,
    fetchTriggerContext,
    submitAction,
    ackTrigger,
    getAuthToken: () => authToken
  };
}
