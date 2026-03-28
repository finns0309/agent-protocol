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
    <div class="rail-agent-main">
      <div class="rail-agent-name">${escapeHtml(agent.name)}</div>
      <div class="rail-agent-role">${escapeHtml(agent.role)}</div>
    </div>
    <div class="rail-agent-stats">${escapeHtml(agent.stats.messages)} msgs</div>
  `;
  return row;
}

function createEventRow(event) {
  const row = document.createElement("div");
  row.className = "event-row";
  row.innerHTML = `
    <span class="event-time">${event.time}</span>
    <span class="event-text">${escapeHtml(event.agent)} · ${escapeHtml(event.text)}</span>
  `;
  return row;
}

export function createNetworkStatusPanel(session, state = {}) {
  const agents = Array.isArray(session.agents) ? session.agents : [];
  const channels = Array.isArray(session.channels) ? session.channels : [];
  const eventLogItems = Array.isArray(session.networkEvents) ? session.networkEvents.slice(0, 6) : [];
  const activeAgents = agents.filter((agent) => agent.active).length || agents.length;
  const messageCount = channels.reduce((sum, channel) => sum + (Array.isArray(channel.messages) ? channel.messages.length : 0), 0);

  const panel = document.createElement("section");
  panel.className = "rail-section status-panel";
  panel.innerHTML = `
    <div class="rail-scroll">
      <h2 class="panel-title-lg">Members</h2>
      <div class="rail-subtitle">observer context on the right</div>
      <div class="rail-metrics">
        <div class="rail-metric">
          <span class="rail-metric-value">${escapeHtml(activeAgents)}/${escapeHtml(agents.length || activeAgents)}</span>
          <span class="rail-metric-label">active</span>
        </div>
        <div class="rail-metric">
          <span class="rail-metric-value">${escapeHtml(messageCount)}</span>
          <span class="rail-metric-label">messages</span>
        </div>
      </div>
      <div class="rail-label">online now</div>
      <div class="rail-agent-list"></div>
      <div class="rail-separator"></div>
      <div class="rail-label">thread context</div>
      <div class="event-log"></div>
    </div>
  `;

  const agentList = panel.querySelector(".rail-agent-list");
  for (const agent of agents) {
    agentList.appendChild(createAgentRow(agent));
  }

  const eventLog = panel.querySelector(".event-log");
  for (const event of eventLogItems) {
    eventLog.appendChild(createEventRow(event));
  }

  return panel;
}
