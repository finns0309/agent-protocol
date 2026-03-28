function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatChannelLabel(event) {
  if (event.channelLabel) {
    return event.channelLabel;
  }
  const channelId = String(event.channelId || "").trim();
  if (!channelId) {
    return "system";
  }
  if (channelId.startsWith("dm-")) {
    return channelId.replace(/^dm-/, "dm:");
  }
  return `#${channelId.replace(/^#/, "")}`;
}

function normalizeLegacyEvent(event) {
  if (event.decisionVerb) {
    return event;
  }

  const text = String(event.text || "").trim();
  const parts = text.includes("—") ? text.split("—").map((part) => part.trim()).filter(Boolean) : [];
  const inferredChannelLabel = parts[0] || "";
  const inferredSummary = parts[1] || "";
  const lowered = text.toLowerCase();
  let decisionVerb = "responded";
  let decisionType = "message";
  let tone = "respond";

  if (lowered.includes("pass")) {
    decisionVerb = "passed";
    decisionType = "no action";
    tone = "pass";
  } else if (lowered.includes("created")) {
    decisionVerb = "created";
    decisionType = "channel";
    tone = "system";
  } else if (lowered.includes("joined")) {
    decisionVerb = "joined";
    decisionType = "network";
    tone = "system";
  } else if (lowered.includes("offer")) {
    decisionType = "offer";
  } else if (lowered.includes("deliver")) {
    decisionType = "deliver";
  } else if (lowered.includes("confirm")) {
    decisionType = "confirm";
  } else if (lowered.includes("route")) {
    decisionType = "route";
  } else if (lowered.includes("inform") || lowered.includes("sent")) {
    decisionType = "inform";
  }

  const toolCallMatch = String(event.badge || "").match(/(\d+)/);
  return {
    ...event,
    channelLabel: event.channelLabel || inferredChannelLabel || "system",
    decisionVerb,
    decisionType,
    decisionSummary:
      event.decisionSummary != null
        ? event.decisionSummary
        : decisionVerb === "responded"
          ? ""
          : inferredSummary || "evaluated but chose not to engage",
    toolCallCount: event.toolCallCount ?? (toolCallMatch ? Number(toolCallMatch[1]) : 0),
    tone: event.tone || tone
  };
}

function summarizeSession(session, state = {}) {
  const agents = Array.isArray(session.agents) ? session.agents : [];
  const channels = Array.isArray(session.channels) ? session.channels : [];
  const activeChannel = channels.find((channel) => channel.id === state.activeChannelId) || channels[0] || null;
  const totalMessages = channels.reduce((sum, channel) => sum + (channel.messages?.length || 0), 0);
  const totalToolCalls = agents.reduce((sum, agent) => sum + Number(agent.stats?.tools || 0), 0);
  const activeAgents = agents.filter((agent) => agent.active).length;
  const traceCount = channels.reduce(
    (sum, channel) => sum + (channel.messages || []).filter((message) => message.trace).length,
    0
  );

  return {
    activeChannel,
    activeAgents,
    totalAgents: agents.length,
    totalMessages,
    totalToolCalls,
    traceCount
  };
}

function createAgentRow(agent) {
  const row = document.createElement("div");
  row.className = `rail-agent ${agent.active ? "is-active" : ""}`;
  const stats = [
    `${escapeHtml(agent.stats.messages)} msgs`,
    `${escapeHtml(agent.stats.tools)} tools`,
    Number.isFinite(Number(agent.stats.channels)) ? `${escapeHtml(agent.stats.channels)} ch` : ""
  ]
    .filter(Boolean)
    .join(" · ");
  const capabilities = Array.isArray(agent.capabilities) ? agent.capabilities.slice(0, 2).join(" · ") : "";
  row.innerHTML = `
    <div class="rail-agent-dot" style="background:${escapeHtml(agent.color)}"></div>
    <div class="rail-agent-main">
      <div class="rail-agent-name-row">
        <div class="rail-agent-name">${escapeHtml(agent.name)}</div>
        ${agent.active ? '<span class="rail-agent-pill">active</span>' : ""}
      </div>
      <div class="rail-agent-role">${escapeHtml(agent.role)}</div>
      ${capabilities ? `<div class="rail-agent-capabilities">${escapeHtml(capabilities)}</div>` : ""}
    </div>
    <div class="rail-agent-stats">${stats}</div>
  `;
  return row;
}

function createEventRow(event) {
  const normalizedEvent = normalizeLegacyEvent(event);
  const row = document.createElement("div");
  row.className = `event-row ${normalizedEvent.tone ? `is-${normalizedEvent.tone}` : ""}`;
  const decisionType = normalizedEvent.decisionType ? escapeHtml(normalizedEvent.decisionType) : "";
  const decisionSummary = normalizedEvent.decisionSummary ? escapeHtml(normalizedEvent.decisionSummary) : "";
  const toolCallText = Number.isFinite(Number(normalizedEvent.toolCallCount)) && Number(normalizedEvent.toolCallCount) > 0
    ? `${escapeHtml(normalizedEvent.toolCallCount)} tool call${Number(normalizedEvent.toolCallCount) > 1 ? "s" : ""}`
    : "";
  row.innerHTML = `
    <div class="event-head">
      <span class="event-time">${escapeHtml(normalizedEvent.time)}</span>
      <span class="event-agent" style="color:${normalizedEvent.color}">${escapeHtml(normalizedEvent.agent)}</span>
      <span class="event-arrow">→</span>
      <span class="event-channel">${escapeHtml(formatChannelLabel(normalizedEvent))}</span>
    </div>
    <div class="event-body">
      <span class="event-decision">${escapeHtml(normalizedEvent.decisionVerb || "acted")}</span>
      ${toolCallText ? '<span class="event-sep">·</span>' : ""}
      ${toolCallText ? `<span class="event-meta">${toolCallText}</span>` : ""}
      ${decisionType ? '<span class="event-sep">·</span>' : ""}
      ${decisionType ? `<span class="event-kind">${decisionType}</span>` : ""}
      ${decisionSummary ? `<span class="event-note">(${decisionSummary})</span>` : ""}
    </div>
  `;
  return row;
}

export function createNetworkStatusPanel(session, state = {}) {
  const summary = summarizeSession(session, state);
  const panel = document.createElement("section");
  panel.className = "rail-section status-panel";
  panel.innerHTML = `
    <div class="rail-scroll">
      <h2 class="panel-title-sm">Network Status</h2>
      <div class="rail-summary-grid">
        <div class="rail-summary-card">
          <span class="rail-summary-label">agents online</span>
          <strong class="rail-summary-value">${escapeHtml(summary.activeAgents)}/${escapeHtml(summary.totalAgents)}</strong>
        </div>
        <div class="rail-summary-card">
          <span class="rail-summary-label">messages</span>
          <strong class="rail-summary-value">${escapeHtml(summary.totalMessages)}</strong>
        </div>
        <div class="rail-summary-card">
          <span class="rail-summary-label">tool calls</span>
          <strong class="rail-summary-value">${escapeHtml(summary.totalToolCalls)}</strong>
        </div>
        <div class="rail-summary-card">
          <span class="rail-summary-label">traces</span>
          <strong class="rail-summary-value">${escapeHtml(summary.traceCount)}</strong>
        </div>
      </div>
      ${
        summary.activeChannel
          ? `
            <div class="rail-context-card">
              <div class="rail-context-label">// current channel</div>
              <div class="rail-context-title">${escapeHtml(summary.activeChannel.prefix === "#" ? "#" : "")}${escapeHtml(summary.activeChannel.label)}</div>
              <div class="rail-context-body">${escapeHtml(summary.activeChannel.topic || "No topic available for this channel.")}</div>
            </div>
          `
          : ""
      }
      <div class="rail-separator"></div>
      <div class="rail-label">// agents</div>
      <div class="rail-agent-list"></div>
      <div class="rail-separator"></div>
      <div class="rail-label">// event log</div>
      <div class="event-log"></div>
    </div>
  `;

  const agentList = panel.querySelector(".rail-agent-list");
  for (const agent of session.agents) {
    agentList.appendChild(createAgentRow(agent));
  }

  const eventLog = panel.querySelector(".event-log");
  if (Array.isArray(session.networkEvents) && session.networkEvents.length) {
    for (const event of session.networkEvents) {
      eventLog.appendChild(createEventRow(event));
    }
  } else {
    const empty = document.createElement("div");
    empty.className = "event-empty";
    empty.textContent = "Decision events will appear here when agents evaluate a trigger.";
    eventLog.appendChild(empty);
  }

  return panel;
}
