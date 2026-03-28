function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function createAgentStatusCard(agent) {
  const card = document.createElement("article");
  card.className = `status-card ${agent.active ? "is-active" : ""}`;
  card.innerHTML = `
    <div class="status-card-top">
      <div class="status-dot" style="background:${escapeHtml(agent.color)}"></div>
      <span class="status-name">${escapeHtml(agent.name)}</span>
    </div>
    <div class="status-role">${escapeHtml(agent.role)}</div>
    <div class="status-stat"><span>msgs sent</span><span>${escapeHtml(agent.stats.messages)}</span></div>
    <div class="status-stat"><span>tool calls</span><span>${escapeHtml(agent.stats.tools)}</span></div>
    <div class="status-stat"><span>channels</span><span>${escapeHtml(agent.stats.channels)}</span></div>
    <div class="status-capabilities">
      ${agent.capabilities.map((capability) => `<span class="status-capability">${escapeHtml(capability)}</span>`).join("")}
    </div>
  `;
  return card;
}
