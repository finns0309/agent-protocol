import {
  ChannelModes,
  createCapabilityProfile,
  createChannel,
  createIdentity
} from "../../../packages/protocol/src/index.js";
import { AgentMemory } from "../../../packages/runtime/src/index.js";
import { createDefaultScenarioRepository } from "./scenario-repository.js";

export const DEFAULT_SCENARIO_ID = "polis-default";
export const DASHBOARD_SCENARIO_ID = "dashboard-spec-studio";
export const SIGNAL_SCENARIO_ID = "signal-war-room";
export const LAUNCH_SCENARIO_ID = "launch-narrative-room";
export const RESEARCH_SCENARIO_ID = "research-brief-lab";

const scenarioRepository = createDefaultScenarioRepository();

function normalizeCapabilityProfile(profile = {}) {
  return createCapabilityProfile({
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    tools: Array.isArray(profile.tools) ? profile.tools : [],
    preferredTasks: Array.isArray(profile.preferredTasks) ? profile.preferredTasks : [],
    forbiddenTasks: Array.isArray(profile.forbiddenTasks) ? profile.forbiddenTasks : [],
    resourceNeeds: Array.isArray(profile.resourceNeeds) ? profile.resourceNeeds : []
  });
}

function createProfileFromSpec(profileSpec = {}) {
  const capabilityProfile = normalizeCapabilityProfile(profileSpec.capabilityProfile);
  const identity = createIdentity({
    id: profileSpec.id,
    displayName: profileSpec.displayName,
    role: profileSpec.role,
    directive: profileSpec.directive || "",
    origin: profileSpec.origin || "internal",
    metadata: {
      capabilityProfile
    }
  });

  return {
    identity,
    capabilityProfile,
    persona: profileSpec.persona || "",
    memory: new AgentMemory({
      summary: profileSpec.memorySummary || ""
    })
  };
}

function seedChannelsFromSpec(spec = {}) {
  const channels = Array.isArray(spec.channels) ? spec.channels : [];
  return (directory) => {
    channels.forEach((channelSpec) => {
      directory.create(
        createChannel({
          id: channelSpec.id,
          mode: channelSpec.mode || ChannelModes.GROUP,
          name: channelSpec.name || channelSpec.id,
          members: Array.isArray(channelSpec.members) ? channelSpec.members : [],
          metadata: channelSpec.metadata || {}
        })
      );
    });
  };
}

function seedMessagesFromSpec(spec = {}) {
  const messages = Array.isArray(spec.initialMessages) ? spec.initialMessages : [];
  return (session) => {
    messages.forEach((message) => {
      session.appendMessage({
        from: message.from,
        channelId: message.channelId,
        type: message.type,
        text: message.text || "",
        content: Array.isArray(message.content) ? message.content : [],
        replyTo: message.replyTo || "",
        metadata: message.metadata || {}
      });
    });
  };
}

export function createScenarioFromSpec(spec = {}) {
  const safeSpec = {
    id: spec.id || "unnamed-scenario",
    name: spec.name || "Untitled Scenario",
    description: spec.description || "",
    worldPrompt: spec.worldPrompt || spec.description || "",
    workspaceName: spec.workspaceName || spec.name || "Workspace",
    recommendedObserverTemplate: spec.recommendedObserverTemplate || "chat",
    recommendedObserverTemplates: Array.isArray(spec.recommendedObserverTemplates)
      ? spec.recommendedObserverTemplates
      : [],
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
    profiles: Array.isArray(spec.profiles) ? spec.profiles : [],
    channels: Array.isArray(spec.channels) ? spec.channels : [],
    initialMessages: Array.isArray(spec.initialMessages) ? spec.initialMessages : []
  };

  return {
    id: safeSpec.id,
    name: safeSpec.name,
    description: safeSpec.description,
    worldPrompt: safeSpec.worldPrompt,
    workspaceName: safeSpec.workspaceName,
    recommendedObserverTemplate: safeSpec.recommendedObserverTemplate,
    recommendedObserverTemplates: safeSpec.recommendedObserverTemplates,
    version: safeSpec.version,
    status: safeSpec.status,
    authors: safeSpec.authors,
    seedSummary: safeSpec.seedSummary,
    notes: safeSpec.notes,
    tags: safeSpec.tags,
    highlights: safeSpec.highlights,
    starterPrompt: safeSpec.starterPrompt,
    registrationTriggerRecipients: safeSpec.registrationTriggerRecipients,
    channelBlueprints: safeSpec.channelBlueprints,
    defaultLaunch: safeSpec.defaultLaunch,
    visual: safeSpec.visual,
    source: safeSpec.source,
    spec: safeSpec,
    createProfiles() {
      return safeSpec.profiles.map((profile) => createProfileFromSpec(profile));
    },
    seedChannels: seedChannelsFromSpec(safeSpec),
    seedInitialMessages: seedMessagesFromSpec(safeSpec)
  };
}

export function loadScenarioSpecById(scenarioId) {
  const spec = scenarioRepository.get(scenarioId);
  if (!spec) {
    const error = new Error(`unknown_scenario:${scenarioId}`);
    error.code = "SCENARIO_NOT_FOUND";
    throw error;
  }
  return spec;
}

export function listScenarioSpecs() {
  return scenarioRepository.list();
}

function buildScenarioFromId(scenarioId) {
  return createScenarioFromSpec(loadScenarioSpecById(scenarioId));
}

export function buildDefaultScenario() {
  return buildScenarioFromId(DEFAULT_SCENARIO_ID);
}

export function buildDashboardSpecScenario() {
  return buildScenarioFromId(DASHBOARD_SCENARIO_ID);
}

export function buildSignalWarRoomScenario() {
  return buildScenarioFromId(SIGNAL_SCENARIO_ID);
}

export function buildLaunchNarrativeScenario() {
  return buildScenarioFromId(LAUNCH_SCENARIO_ID);
}

export function buildResearchBriefScenario() {
  return buildScenarioFromId(RESEARCH_SCENARIO_ID);
}
