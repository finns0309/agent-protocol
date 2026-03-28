import { createAgentStatusCard } from "./agent-status-card.js";

export function createAgentStatusGrid(agents) {
  const wrapper = document.createElement("div");
  wrapper.className = "status-grid";

  for (const agent of agents) {
    wrapper.appendChild(createAgentStatusCard(agent));
  }

  return wrapper;
}
