function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createAgentRow(agent) {
  const row = document.createElement("div");
  row.className = `rail-agent ${agent.active ? "is-active" : ""}`;
  row.innerHTML = `
    <div class="rail-agent-dot" style="background:${escapeHtml(agent.color)}"></div>
    <div class="rail-agent-main">
      <div class="rail-agent-name">${escapeHtml(agent.name)}</div>
      <div class="rail-agent-role">${escapeHtml(agent.role)}</div>
    </div>
    <div class="rail-agent-stats">${escapeHtml(agent.stats.messages)}m ${escapeHtml(agent.stats.tools)}t</div>
  `;
  return row;
}

function createEventRow(event) {
  const row = document.createElement("div");
  row.className = "event-row";
  row.innerHTML = `
    <span class="event-time">${event.time}</span>
    <span class="event-agent" style="color:${event.color}">${event.agent}</span>
    <span class="event-text">${event.text}</span>
    ${event.badge ? `<span class="event-pill">${event.badge}</span>` : ""}
  `;
  return row;
}

export function createNetworkStatusPanel(session, state = {}) {
  const panel = document.createElement("section");
  panel.className = "rail-section status-panel";
  if (state.railCollapsed) {
    panel.classList.add("is-collapsed");
  }
  panel.innerHTML = `
    <div class="rail-scroll">
      <h2 class="panel-title-sm">Agent network status</h2>
      <div class="rail-label">agents</div>
      <div class="rail-agent-list"></div>
      <div class="rail-separator"></div>
      <div class="rail-label">event log</div>
      <div class="event-log"></div>
    </div>
  `;

  const agentList = panel.querySelector(".rail-agent-list");
  for (const agent of session.agents) {
    agentList.appendChild(createAgentRow(agent));
  }

  const eventLog = panel.querySelector(".event-log");
  for (const event of session.networkEvents) {
    eventLog.appendChild(createEventRow(event));
  }

  return panel;
}
