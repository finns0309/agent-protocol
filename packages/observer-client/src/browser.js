function buildWindowFallbackBase(defaultPort = 4190) {
  if (typeof window === "undefined" || !window.location) {
    return `http://127.0.0.1:${defaultPort}`;
  }

  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const hostname = window.location.hostname || "127.0.0.1";
  return `${protocol}//${hostname}:${defaultPort}`;
}

export async function loadObserverConfig(options = {}) {
  const {
    configUrl = "/api/config",
    fallbackNetworkApiBase = buildWindowFallbackBase(4190)
  } = options;

  try {
    const response = await fetch(`${configUrl}?ts=${Date.now()}`, {
      cache: "no-store"
    });
    if (!response.ok) {
      return {
        networkApiBase: fallbackNetworkApiBase
      };
    }
    return await response.json();
  } catch {
    return {
      networkApiBase: fallbackNetworkApiBase
    };
  }
}

function encodeQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  return search.toString();
}

export async function fetchSessionSnapshot(networkApiBase, options = {}) {
  const { sessionId = "" } = options;
  const path = sessionId ? `/api/sessions/${encodeURIComponent(sessionId)}` : "/api/session";
  const query = encodeQuery({ ts: Date.now() });
  const response = await fetch(`${networkApiBase}${path}?${query}`, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`session_fetch_failed:${response.status}`);
  }
  return await response.json();
}

export async function fetchScenarioList(networkApiBase) {
  const response = await fetch(`${networkApiBase}/api/scenarios?ts=${Date.now()}`, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`scenario_fetch_failed:${response.status}`);
  }
  const json = await response.json();
  return Array.isArray(json.scenarios) ? json.scenarios : [];
}

export async function fetchSessionList(networkApiBase) {
  const response = await fetch(`${networkApiBase}/api/sessions?ts=${Date.now()}`, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`session_list_fetch_failed:${response.status}`);
  }
  const json = await response.json();
  return Array.isArray(json.sessions) ? json.sessions : [];
}

export async function createSessionRecord(networkApiBase, spec = {}) {
  const response = await fetch(`${networkApiBase}/api/sessions`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(spec)
  });
  if (!response.ok) {
    throw new Error(`session_create_failed:${response.status}`);
  }
  const json = await response.json();
  return json.session || null;
}

function excerptText(value, limit = 96) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

function normalizeMessage(message, messageIndex) {
  return {
    ...message,
    rawTimestamp: message.rawTimestamp || 0,
    replyPreview: message.replyTo ? messageIndex.get(message.replyTo) || null : null,
    mentionedIds: Array.isArray(message.mentionedIds) ? message.mentionedIds : []
  };
}

function normalizeReaction(reaction, messageIndex) {
  const targetMessageId = reaction.envelopeId || reaction.data?.targetMessageId || "";
  return {
    ...reaction,
    rawTimestamp: reaction.rawTimestamp || 0,
    targetMessageId,
    targetMessagePreview: targetMessageId ? messageIndex.get(targetMessageId) || null : null
  };
}

function normalizeChannel(channel) {
  const rawMessages = Array.isArray(channel.messages) ? channel.messages : [];
  const messageIndex = new Map(
    rawMessages.map((message) => [
      message.id,
      {
        id: message.id,
        actorId: message.actorId,
        actorName: message.actorName,
        type: message.type,
        text: String(message.text || "")
      }
    ])
  );

  const messages = rawMessages.map((message) => normalizeMessage(message, messageIndex));
  const reactions = (Array.isArray(channel.reactions) ? channel.reactions : []).map((reaction) =>
    normalizeReaction(reaction, messageIndex)
  );
  const pinnedMessages = (Array.isArray(channel.pinnedMessageIds) ? channel.pinnedMessageIds : [])
    .map((messageId) => messageIndex.get(messageId))
    .filter(Boolean);

  const timeline = [
    ...messages.map((message) => ({ kind: "message", id: message.id, rawTimestamp: message.rawTimestamp || 0, message })),
    ...reactions.map((reaction) => ({ kind: "reaction", id: reaction.id, rawTimestamp: reaction.rawTimestamp || 0, reaction }))
  ].sort((left, right) => {
    if (left.rawTimestamp === right.rawTimestamp) {
      return left.id.localeCompare(right.id);
    }
    return left.rawTimestamp - right.rawTimestamp;
  });

  return {
    ...channel,
    messages,
    reactions,
    pinnedMessages,
    timeline
  };
}

export function normalizeSessionSnapshot(session = {}) {
  const channels = Array.isArray(session.channels) ? session.channels.map((channel) => normalizeChannel(channel)) : [];
  return {
    ...session,
    channels
  };
}
