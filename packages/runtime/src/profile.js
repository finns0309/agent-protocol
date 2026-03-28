import { createCapabilityProfile } from "../../protocol/src/capability.js";

export function resolveCapabilityProfile(input = {}) {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return createCapabilityProfile(input);
  }

  return createCapabilityProfile({});
}

export function summarizeCapabilityProfile(profile) {
  const safe = resolveCapabilityProfile(profile);
  return {
    skills: safe.skills.join(", ") || "none",
    tools: safe.tools.join(", ") || "none",
    preferredTasks: safe.preferredTasks.join(", ") || "none",
    forbiddenTasks: safe.forbiddenTasks.join(", ") || "none",
    resourceNeeds: safe.resourceNeeds.join(", ") || "none"
  };
}
