import { assertArray, assertObject, clone } from "./utils.js";

export function createCapabilityProfile(spec = {}) {
  assertObject(spec, "capabilityProfile");
  assertArray(spec.skills || [], "capabilityProfile.skills");
  assertArray(spec.tools || [], "capabilityProfile.tools");
  assertArray(spec.preferredTasks || [], "capabilityProfile.preferredTasks");
  assertArray(spec.forbiddenTasks || [], "capabilityProfile.forbiddenTasks");
  assertArray(spec.resourceNeeds || [], "capabilityProfile.resourceNeeds");

  return clone({
    skills: spec.skills || [],
    tools: spec.tools || [],
    preferredTasks: spec.preferredTasks || [],
    forbiddenTasks: spec.forbiddenTasks || [],
    resourceNeeds: spec.resourceNeeds || []
  });
}

export function summarizeCapabilityProfile(profile) {
  const safe = createCapabilityProfile(profile || {});
  return {
    skills: safe.skills.join(", "),
    tools: safe.tools.join(", "),
    preferredTasks: safe.preferredTasks.join(", "),
    forbiddenTasks: safe.forbiddenTasks.join(", "),
    resourceNeeds: safe.resourceNeeds.join(", ")
  };
}
