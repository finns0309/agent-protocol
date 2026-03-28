import { fetchSessionSnapshot, loadObserverConfig, normalizeSessionSnapshot } from "/__observer-client.js";

function createState() {
  const requestedSessionId =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("sessionId") || "" : "";

  return {
    session: null,
    networkApiBase: "http://127.0.0.1:4190",
    sessionId: requestedSessionId,
    selectedAgentId: "",
    lastUpdatedAt: 0,
    refreshing: false,
    filters: {
      search: "",
      status: "all",
      externalOnly: false,
      trustedOnly: false,
      toolHeavyOnly: false,
      sort: "activity"
    }
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function excerpt(value, limit = 140) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

function formatRelativeTime(rawTimestamp) {
  if (!rawTimestamp) {
    return "No activity yet";
  }

  const deltaSeconds = Math.max(0, Math.floor((Date.now() - rawTimestamp) / 1000));
  if (deltaSeconds < 10) {
    return "Just now";
  }
  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }
  if (deltaSeconds < 3600) {
    return `${Math.floor(deltaSeconds / 60)}m ago`;
  }
  return `${Math.floor(deltaSeconds / 3600)}h ago`;
}

function flattenMessages(session) {
  const channels = Array.isArray(session?.channels) ? session.channels : [];
  return channels
    .flatMap((channel) =>
      (Array.isArray(channel.messages) ? channel.messages : []).map((message) => ({
        ...message,
        channelId: channel.id,
        channelLabel: channel.label,
        channelPrefix: channel.prefix,
        visibility: channel.visibility
      }))
    )
    .sort((left, right) => (right.rawTimestamp || 0) - (left.rawTimestamp || 0));
}

function groupMessagesByAgent(messages) {
  const index = new Map();
  for (const message of messages) {
    if (!message.actorId) {
      continue;
    }
    if (!index.has(message.actorId)) {
      index.set(message.actorId, []);
    }
    index.get(message.actorId).push(message);
  }
  return index;
}

function groupEventsByAgent(events) {
  const index = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    if (!event.agentId) {
      continue;
    }
    if (!index.has(event.agentId)) {
      index.set(event.agentId, []);
    }
    index.get(event.agentId).push(event);
  }
  return index;
}

function inferStatus(agent, lastMessageAt) {
  if (agent.active) {
    return "active";
  }
  if (!lastMessageAt) {
    return "absent";
  }

  const deltaSeconds = Math.max(0, Math.floor((Date.now() - lastMessageAt) / 1000));
  if (deltaSeconds < 90) {
    return "recent";
  }
  if (deltaSeconds < 600) {
    return "warm";
  }
  return "quiet";
}

function buildAgentViewModel(session) {
  const agents = Array.isArray(session?.agents) ? session.agents : [];
  const flattenedMessages = flattenMessages(session);
  const messagesByAgent = groupMessagesByAgent(flattenedMessages);
  const eventsByAgent = groupEventsByAgent(session?.networkEvents || []);

  return agents.map((agent) => {
    const recentMessages = messagesByAgent.get(agent.id) || [];
    const recentEvents = eventsByAgent.get(agent.id) || [];
    const lastMessage = recentMessages[0] || null;
    const lastDecision = recentEvents[0] || null;
    const channels = Array.from(
      new Set(
        recentMessages
          .map((message) => ({
            id: message.channelId,
            label: `${message.channelPrefix === "dm" ? "dm" : "#"}${message.channelLabel || message.channelId || "unknown"}`
          }))
          .map((channel) => JSON.stringify(channel))
      )
    )
      .map((item) => JSON.parse(item))
      .slice(0, 4);
    const lastMessageAt = lastMessage?.rawTimestamp || 0;
    const status = inferStatus(agent, lastMessageAt);
    const messageCount = Number(agent.stats?.messages || 0);
    const toolCount = Number(agent.stats?.tools || 0);
    const toolBias = messageCount ? toolCount / messageCount : toolCount > 0 ? toolCount : 0;
    const social = agent.social || {};
    const onboarding = social.onboarding || {};

    return {
      ...agent,
      status,
      statusLabel: {
        active: "Active",
        recent: "Recent",
        warm: "Warm",
        quiet: "Quiet",
        absent: "Absent"
      }[status],
      lastMessage,
      lastDecision,
      lastActivityAt: lastMessageAt,
      lastActivityLabel: formatRelativeTime(lastMessageAt),
      recentMessages: recentMessages.slice(0, 6),
      recentEvents: recentEvents.slice(0, 5),
      recentChannels: channels,
      isExternal: Boolean(agent.connector?.connectorType || agent.connector),
      trustState: onboarding.trustState || "",
      presenceState: onboarding.presenceState || "",
      integrationOutcome: onboarding.integrationOutcome || "",
      reputationScore: Number(social.reputationScore || 0),
      reactionCount: Number(social.reactionCount || 0),
      capabilityList: Array.isArray(agent.capabilities) ? agent.capabilities : [],
      toolBias,
      activityScore:
        (status === "active" ? 1000 : 0) +
        Math.max(0, 600000 - Math.min(600000, Date.now() - (lastMessageAt || 0))) +
        messageCount * 25 +
        toolCount * 40 +
        Number(social.reputationScore || 0) * 20
    };
  });
}

function statusMatch(agent, status) {
  if (status === "all") {
    return true;
  }
  return agent.status === status;
}

function sortAgents(agents, sort) {
  const ranked = [...agents];
  ranked.sort((left, right) => {
    switch (sort) {
      case "messages":
        return (right.stats?.messages || 0) - (left.stats?.messages || 0);
      case "tools":
        return (right.stats?.tools || 0) - (left.stats?.tools || 0);
      case "reputation":
        return (right.reputationScore || 0) - (left.reputationScore || 0);
      case "name":
        return String(left.name || "").localeCompare(String(right.name || ""));
      case "activity":
      default:
        return (right.activityScore || 0) - (left.activityScore || 0);
    }
  });
  return ranked;
}

function filterAgents(agents, filters) {
  const query = String(filters.search || "").trim().toLowerCase();

  return agents.filter((agent) => {
    if (!statusMatch(agent, filters.status)) {
      return false;
    }
    if (filters.externalOnly && !agent.isExternal) {
      return false;
    }
    if (filters.trustedOnly && agent.trustState !== "trusted") {
      return false;
    }
    if (filters.toolHeavyOnly && agent.toolBias < 1) {
      return false;
    }
    if (!query) {
      return true;
    }

    const fields = [
      agent.name,
      agent.role,
      agent.connector?.connectorType,
      agent.trustState,
      agent.presenceState,
      agent.integrationOutcome,
      ...(agent.capabilityList || []).map((item) => item?.label || item?.name || item)
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return fields.includes(query);
  });
}

function summarizeWorkspace(session) {
  const channels = Array.isArray(session?.channels) ? session.channels : [];
  const messages = flattenMessages(session);
  const activeCount = (Array.isArray(session?.agents) ? session.agents : []).filter((agent) => agent.active).length;

  return {
    workspaceName: session?.workspace?.name || "Polis",
    sessionName: session?.session?.name || "",
    channelCount: channels.length,
    messageCount: messages.length,
    agentCount: Array.isArray(session?.agents) ? session.agents.length : 0,
    activeCount,
    externalCount: (Array.isArray(session?.agents) ? session.agents : []).filter(
      (agent) => agent.connector?.connectorType || agent.connector
    ).length
  };
}

function countByStatus(agents) {
  return agents.reduce(
    (acc, agent) => {
      acc[agent.status] = (acc[agent.status] || 0) + 1;
      return acc;
    },
    {
      active: 0,
      recent: 0,
      warm: 0,
      quiet: 0,
      absent: 0
    }
  );
}

function renderMetric(label, value, tone = "") {
  return `
    <div class="metric ${tone ? `metric-${tone}` : ""}">
      <span class="metric-label">${escapeHtml(label)}</span>
      <strong class="metric-value">${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderChannelPills(agent) {
  if (!agent.recentChannels.length) {
    return `<span class="channel-pill is-empty">No channels yet</span>`;
  }

  return agent.recentChannels
    .map(
      (channel) => `
        <span class="channel-pill">${escapeHtml(channel.label)}</span>
      `
    )
    .join("");
}

function renderCapabilityPills(agent) {
  if (!agent.capabilityList.length) {
    return `<span class="cap-pill is-empty">No declared skills</span>`;
  }

  return agent.capabilityList
    .slice(0, 4)
    .map((skill) => {
      const label = typeof skill === "string" ? skill : skill?.label || skill?.name || "skill";
      return `<span class="cap-pill">${escapeHtml(label)}</span>`;
    })
    .join("");
}

function renderAgentCard(agent, selected) {
  const lastMessageText = excerpt(agent.lastMessage?.text || agent.lastMessage?.content?.[0]?.text || "", 112);
  const decisionText = agent.lastDecision?.text || "";
  const toolBiasPercent = Math.min(100, Math.round(Math.max(0, agent.toolBias) * 35));

  return `
    <button class="agent-card ${selected ? "is-selected" : ""}" data-agent-card="${escapeHtml(agent.id)}" type="button">
      <div class="agent-card-head">
        <div class="agent-identity">
          <span class="agent-avatar" style="background:${escapeHtml(agent.color)}">${escapeHtml(
            (agent.name || "?")
              .split(" ")
              .map((part) => part[0] || "")
              .join("")
              .slice(0, 2)
              .toUpperCase()
          )}</span>
          <div>
            <div class="agent-name-row">
              <span class="agent-name">${escapeHtml(agent.name)}</span>
              ${agent.isExternal ? '<span class="agent-badge is-external">External</span>' : ""}
            </div>
            <div class="agent-role">${escapeHtml(agent.role)}</div>
          </div>
        </div>
        <span class="status-chip status-${escapeHtml(agent.status)}">${escapeHtml(agent.statusLabel)}</span>
      </div>

      <div class="agent-meta-row">
        <span>${escapeHtml(agent.lastActivityLabel)}</span>
        <span>${escapeHtml(agent.presenceState || "presence unknown")}</span>
      </div>

      <div class="snapshot-block">
        <div class="snapshot-label">Latest message</div>
        <div class="snapshot-text ${lastMessageText ? "" : "is-empty"}">${escapeHtml(lastMessageText || "No messages yet")}</div>
      </div>

      <div class="snapshot-block">
        <div class="snapshot-label">Latest decision</div>
        <div class="snapshot-text ${decisionText ? "" : "is-empty"}">${escapeHtml(decisionText || "No recent decisions")}</div>
      </div>

      <div class="metrics-grid">
        ${renderMetric("Messages", agent.stats?.messages || 0)}
        ${renderMetric("Tools", agent.stats?.tools || 0)}
        ${renderMetric("Rep", agent.reputationScore, "accent")}
        ${renderMetric("Signals", agent.reactionCount)}
      </div>

      <div class="tool-bias">
        <div class="tool-bias-head">
          <span>Tool intensity</span>
          <span>${escapeHtml(agent.toolBias.toFixed(1))}x</span>
        </div>
        <div class="tool-bias-track">
          <span class="tool-bias-fill" style="width:${toolBiasPercent}%"></span>
        </div>
      </div>

      <div class="card-pills">${renderChannelPills(agent)}</div>
    </button>
  `;
}

function renderMessageFeed(messages) {
  if (!messages.length) {
    return `<div class="detail-empty">No messages yet.</div>`;
  }

  return messages
    .map(
      (message) => `
        <article class="detail-entry">
          <div class="detail-entry-head">
            <span class="detail-type type-${escapeHtml(message.type || "chat")}">${escapeHtml(message.type || "chat")}</span>
            <span class="detail-channel">${escapeHtml(
              `${message.channelPrefix === "dm" ? "dm" : "#"}${message.channelLabel || message.channelId || "unknown"}`
            )}</span>
            <span class="detail-time">${escapeHtml(message.timestamp || "")}</span>
          </div>
          <div class="detail-text">${escapeHtml(excerpt(message.text || "", 220) || "Empty message")}</div>
        </article>
      `
    )
    .join("");
}

function renderDecisionFeed(events) {
  if (!events.length) {
    return `<div class="detail-empty">No recent decisions.</div>`;
  }

  return events
    .map(
      (event) => `
        <article class="detail-entry">
          <div class="detail-entry-head">
            <span class="detail-type type-event">${escapeHtml(event.actionType || "action")}</span>
            <span class="detail-channel">${escapeHtml(event.channelLabel || "system")}</span>
            <span class="detail-time">${escapeHtml(event.time || "")}</span>
          </div>
          <div class="detail-text">${escapeHtml(event.text || "")}</div>
          ${event.badge ? `<div class="detail-subtext">${escapeHtml(event.badge)}</div>` : ""}
        </article>
      `
    )
    .join("");
}

function renderDetailPanel(agent) {
  if (!agent) {
    return `
      <div class="detail-panel is-empty">
        <div class="detail-empty-title">Select an agent</div>
        <p class="detail-empty-copy">Pick a card to inspect recent messages, decisions, trust signals, and channel footprint.</p>
      </div>
    `;
  }

  return `
    <div class="detail-panel">
      <div class="detail-hero">
        <div class="detail-hero-main">
          <span class="detail-avatar" style="background:${escapeHtml(agent.color)}">${escapeHtml(
            (agent.name || "?")
              .split(" ")
              .map((part) => part[0] || "")
              .join("")
              .slice(0, 2)
              .toUpperCase()
          )}</span>
          <div>
            <div class="detail-name-row">
              <h2>${escapeHtml(agent.name)}</h2>
              <span class="status-chip status-${escapeHtml(agent.status)}">${escapeHtml(agent.statusLabel)}</span>
            </div>
            <p class="detail-role">${escapeHtml(agent.role)}</p>
          </div>
        </div>
        ${agent.connector?.connectorType ? `<div class="detail-connector">${escapeHtml(agent.connector.connectorType)}</div>` : ""}
      </div>

      <div class="detail-metrics">
        ${renderMetric("Messages", agent.stats?.messages || 0)}
        ${renderMetric("Tools", agent.stats?.tools || 0)}
        ${renderMetric("Channels", agent.stats?.channels || 0)}
        ${renderMetric("Reputation", agent.reputationScore, "accent")}
      </div>

      <div class="detail-strip">
        <span class="detail-pill">${escapeHtml(agent.presenceState || "presence unknown")}</span>
        <span class="detail-pill">${escapeHtml(agent.trustState || "trust unknown")}</span>
        <span class="detail-pill">${escapeHtml(agent.integrationOutcome || "integration unknown")}</span>
      </div>

      <section class="detail-section">
        <div class="detail-section-title">Channel footprint</div>
        <div class="detail-pill-row">${renderChannelPills(agent)}</div>
      </section>

      <section class="detail-section">
        <div class="detail-section-title">Capabilities</div>
        <div class="detail-pill-row">${renderCapabilityPills(agent)}</div>
      </section>

      <section class="detail-section">
        <div class="detail-section-title">Recent messages</div>
        <div class="detail-feed">${renderMessageFeed(agent.recentMessages)}</div>
      </section>

      <section class="detail-section">
        <div class="detail-section-title">Recent decisions</div>
        <div class="detail-feed">${renderDecisionFeed(agent.recentEvents)}</div>
      </section>
    </div>
  `;
}

function renderEmptyGrid() {
  return `
    <div class="grid-empty">
      <div class="grid-empty-title">No agents match these filters</div>
      <p class="grid-empty-copy">Broaden the search or relax one of the status constraints.</p>
    </div>
  `;
}

function render(root, state) {
  if (!state.session) {
    root.innerHTML = `
      <div class="workbench-shell">
        <div class="waiting-panel">
          <div class="waiting-kicker">Agent Workbench</div>
          <h1>Waiting for network snapshot</h1>
          <p>The UI is ready. Once the network server responds, each agent will appear as its own control surface.</p>
        </div>
      </div>
    `;
    return;
  }

  const summary = summarizeWorkspace(state.session);
  const allAgents = buildAgentViewModel(state.session);
  const visibleAgents = sortAgents(filterAgents(allAgents, state.filters), state.filters.sort);
  const selectedAgent =
    allAgents.find((agent) => agent.id === state.selectedAgentId) || visibleAgents[0] || allAgents[0] || null;
  const statusCounts = countByStatus(allAgents);

  root.innerHTML = `
    <div class="workbench-shell">
      <div class="ambient ambient-a"></div>
      <div class="ambient ambient-b"></div>

      <header class="hero">
        <div class="hero-copy">
          <div class="hero-kicker">Observer mode / agent workbench</div>
          <h1>${escapeHtml(summary.workspaceName)}</h1>
          <p>
            Compare agent activity, trust posture, output cadence, and recent decisions side by side.
          </p>
        </div>

        <div class="hero-metrics">
          ${renderMetric("Agents", summary.agentCount)}
          ${renderMetric("Active", summary.activeCount, "accent")}
          ${renderMetric("External", summary.externalCount)}
          ${renderMetric("Messages", summary.messageCount)}
        </div>
      </header>

      <div class="toolbar">
        <div class="toolbar-left">
          <span class="toolbar-chip">${escapeHtml(summary.sessionName || "Default session")}</span>
          <span class="toolbar-chip">${escapeHtml(`${summary.channelCount} channels`)}</span>
          <span class="toolbar-chip">${escapeHtml(new Date(state.lastUpdatedAt || Date.now()).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
          }))}</span>
        </div>
        <button class="refresh-button" type="button" data-refresh ${state.refreshing ? "disabled" : ""}>
          ${state.refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div class="layout">
        <aside class="control-panel">
          <div class="panel-title">Filters</div>
          <label class="field">
            <span class="field-label">Search</span>
            <input type="search" class="field-input" data-search value="${escapeHtml(state.filters.search)}" placeholder="name, role, skill..." />
          </label>

          <label class="field">
            <span class="field-label">Sort</span>
            <select class="field-select" data-sort>
              <option value="activity" ${state.filters.sort === "activity" ? "selected" : ""}>Activity</option>
              <option value="messages" ${state.filters.sort === "messages" ? "selected" : ""}>Messages</option>
              <option value="tools" ${state.filters.sort === "tools" ? "selected" : ""}>Tools</option>
              <option value="reputation" ${state.filters.sort === "reputation" ? "selected" : ""}>Reputation</option>
              <option value="name" ${state.filters.sort === "name" ? "selected" : ""}>Name</option>
            </select>
          </label>

          <div class="field">
            <span class="field-label">Status</span>
            <div class="status-row">
              <button class="filter-pill ${state.filters.status === "all" ? "is-active" : ""}" data-status="all" type="button">All ${statusCounts.active + statusCounts.recent + statusCounts.warm + statusCounts.quiet + statusCounts.absent}</button>
              <button class="filter-pill ${state.filters.status === "active" ? "is-active" : ""}" data-status="active" type="button">Active ${statusCounts.active}</button>
              <button class="filter-pill ${state.filters.status === "recent" ? "is-active" : ""}" data-status="recent" type="button">Recent ${statusCounts.recent}</button>
              <button class="filter-pill ${state.filters.status === "warm" ? "is-active" : ""}" data-status="warm" type="button">Warm ${statusCounts.warm}</button>
              <button class="filter-pill ${state.filters.status === "quiet" ? "is-active" : ""}" data-status="quiet" type="button">Quiet ${statusCounts.quiet}</button>
              <button class="filter-pill ${state.filters.status === "absent" ? "is-active" : ""}" data-status="absent" type="button">Absent ${statusCounts.absent}</button>
            </div>
          </div>

          <div class="field">
            <span class="field-label">Flags</span>
            <label class="toggle">
              <input type="checkbox" data-flag="externalOnly" ${state.filters.externalOnly ? "checked" : ""} />
              <span>External only</span>
            </label>
            <label class="toggle">
              <input type="checkbox" data-flag="trustedOnly" ${state.filters.trustedOnly ? "checked" : ""} />
              <span>Trusted only</span>
            </label>
            <label class="toggle">
              <input type="checkbox" data-flag="toolHeavyOnly" ${state.filters.toolHeavyOnly ? "checked" : ""} />
              <span>Tool-heavy only</span>
            </label>
          </div>
        </aside>

        <main class="card-stage">
          <div class="panel-title">Agent wall</div>
          <div class="agent-grid">
            ${visibleAgents.length ? visibleAgents.map((agent) => renderAgentCard(agent, selectedAgent?.id === agent.id)).join("") : renderEmptyGrid()}
          </div>
        </main>

        <aside class="detail-stage">
          <div class="panel-title">Inspector</div>
          ${renderDetailPanel(selectedAgent)}
        </aside>
      </div>
    </div>
  `;
}

function attachInteractions(root, state, setState, refresh) {
  root.querySelector("[data-refresh]")?.addEventListener("click", () => {
    refresh();
  });

  root.querySelector("[data-search]")?.addEventListener("input", (event) => {
    setState((current) => ({
      ...current,
      filters: {
        ...current.filters,
        search: event.target.value
      }
    }));
  });

  root.querySelector("[data-sort]")?.addEventListener("change", (event) => {
    setState((current) => ({
      ...current,
      filters: {
        ...current.filters,
        sort: event.target.value
      }
    }));
  });

  for (const button of root.querySelectorAll("[data-status]")) {
    button.addEventListener("click", () => {
      const nextStatus = button.getAttribute("data-status") || "all";
      setState((current) => ({
        ...current,
        filters: {
          ...current.filters,
          status: nextStatus
        }
      }));
    });
  }

  for (const toggle of root.querySelectorAll("[data-flag]")) {
    toggle.addEventListener("change", () => {
      const key = toggle.getAttribute("data-flag");
      setState((current) => ({
        ...current,
        filters: {
          ...current.filters,
          [key]: toggle.checked
        }
      }));
    });
  }

  for (const card of root.querySelectorAll("[data-agent-card]")) {
    card.addEventListener("click", () => {
      const agentId = card.getAttribute("data-agent-card") || "";
      setState((current) => ({
        ...current,
        selectedAgentId: agentId
      }));
    });
  }
}

async function mount() {
  const root = document.getElementById("app");
  if (!root) {
    return;
  }

  let state = {
    ...createState(),
    ...(await loadObserverConfig())
  };

  let refresh = async () => {};

  const setState = (updater) => {
    state = typeof updater === "function" ? updater(state) : updater;
    render(root, state);
    attachInteractions(root, state, setState, refresh);
  };

  const sync = async ({ showRefreshing = false } = {}) => {
    if (showRefreshing) {
      setState((current) => ({
        ...current,
        refreshing: true
      }));
    }

    try {
      const nextSession = normalizeSessionSnapshot(
        await fetchSessionSnapshot(state.networkApiBase, {
          sessionId: state.sessionId
        })
      );

      if (!nextSession || (nextSession.updatedAt || 0) === state.lastUpdatedAt) {
        setState((current) => ({
          ...current,
          refreshing: false
        }));
        return;
      }

      const availableAgents = Array.isArray(nextSession.agents) ? nextSession.agents : [];
      const selectedStillExists = availableAgents.some((agent) => agent.id === state.selectedAgentId);

      setState((current) => ({
        ...current,
        session: nextSession,
        lastUpdatedAt: nextSession.updatedAt || Date.now(),
        refreshing: false,
        selectedAgentId: selectedStillExists ? current.selectedAgentId : availableAgents[0]?.id || ""
      }));
    } catch {
      setState((current) => ({
        ...current,
        refreshing: false
      }));
    }
  };

  refresh = () => sync({ showRefreshing: true });

  render(root, state);
  attachInteractions(root, state, setState, refresh);

  await sync();
  window.setInterval(() => {
    sync();
  }, 1800);
}

if (typeof document !== "undefined") {
  mount();
}
