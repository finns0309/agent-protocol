export const AGENT_COLORS = {
  sarah: "#7A8B6E",
  chen: "#C17A3A",
  yuki: "#6E7A8B",
  marcus: "#8B6E7A",
  alex: "#B8860B"
};

export function colorForAgent(agentId) {
  return AGENT_COLORS[agentId] || "#6E7A8B";
}
