import { createScenarioFromSpec } from "./scenario.js";
import { createDefaultScenarioRepository } from "./scenario-repository.js";

function toScenarioSummary(spec) {
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description || "",
    worldPrompt: spec.worldPrompt || "",
    workspaceName: spec.workspaceName || spec.name || "Workspace",
    recommendedObserverTemplate: spec.recommendedObserverTemplate || "chat",
    recommendedObserverTemplates: Array.isArray(spec.recommendedObserverTemplates)
      ? spec.recommendedObserverTemplates
      : [],
    worldType: spec.worldType || "general",
    version: spec.version || "1",
    status: spec.status || "active",
    authors: Array.isArray(spec.authors) ? spec.authors : [],
    seedSummary: spec.seedSummary || "",
    notes: spec.notes || "",
    tags: Array.isArray(spec.tags) ? spec.tags : [],
    highlights: Array.isArray(spec.highlights) ? spec.highlights : [],
    starterPrompt: spec.starterPrompt || "",
    registrationTriggerRecipients: Array.isArray(spec.registrationTriggerRecipients)
      ? spec.registrationTriggerRecipients
      : [],
    channelBlueprints: Array.isArray(spec.channelBlueprints) ? spec.channelBlueprints : [],
    defaultLaunch: spec.defaultLaunch || {},
    visual: spec.visual || null,
    source: spec.source || null,
    profileCount: Array.isArray(spec.profiles) ? spec.profiles.length : 0,
    channelCount: Array.isArray(spec.channels) ? spec.channels.length : 0,
    initialMessageCount: Array.isArray(spec.initialMessages) ? spec.initialMessages.length : 0
  };
}

export class ScenarioRegistry {
  constructor(scenarioSpecsOrRepository = []) {
    this.specs = new Map();
    this.runtimeCache = new Map();
    this.repository =
      scenarioSpecsOrRepository && typeof scenarioSpecsOrRepository.list === "function"
        ? scenarioSpecsOrRepository
        : null;

    const scenarioSpecs = this.repository ? this.repository.list() : scenarioSpecsOrRepository;
    for (const scenarioSpec of scenarioSpecs) {
      this.register(scenarioSpec);
    }
  }

  refreshFromRepository() {
    if (!this.repository) {
      return;
    }
    const nextSpecs = this.repository.list();
    this.specs.clear();
    this.runtimeCache.clear();
    for (const scenarioSpec of nextSpecs) {
      this.register(scenarioSpec);
    }
  }

  register(scenarioSpec) {
    if (!scenarioSpec?.id) {
      throw new Error("scenario_id_required");
    }
    this.specs.set(scenarioSpec.id, scenarioSpec);
    this.runtimeCache.delete(scenarioSpec.id);
    return scenarioSpec;
  }

  get(scenarioId) {
    this.refreshFromRepository();
    if (!this.specs.has(scenarioId)) {
      return null;
    }
    if (!this.runtimeCache.has(scenarioId)) {
      this.runtimeCache.set(scenarioId, createScenarioFromSpec(this.specs.get(scenarioId)));
    }
    return this.runtimeCache.get(scenarioId) || null;
  }

  getSpec(scenarioId) {
    this.refreshFromRepository();
    const spec = this.specs.get(scenarioId);
    return spec ? JSON.parse(JSON.stringify(spec)) : null;
  }

  list() {
    this.refreshFromRepository();
    return Array.from(this.specs.values()).map(toScenarioSummary);
  }

  first() {
    this.refreshFromRepository();
    const firstSpec = Array.from(this.specs.values())[0];
    return firstSpec ? this.get(firstSpec.id) : null;
  }
}

export function createScenarioRegistry(repository = createDefaultScenarioRepository()) {
  return new ScenarioRegistry(repository);
}
