function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asStringOrNull(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function fail(sourceName, message) {
  throw new Error(`invalid_scenario_spec:${sourceName}:${message}`);
}

function requireString(sourceName, value, field) {
  if (typeof value !== "string" || !value.trim()) {
    fail(sourceName, `${field}_required`);
  }
  return value;
}

function validateProfile(sourceName, profile, index) {
  const prefix = `profiles[${index}]`;
  return {
    id: requireString(sourceName, profile?.id, `${prefix}.id`),
    displayName: requireString(sourceName, profile?.displayName, `${prefix}.displayName`),
    role: requireString(sourceName, profile?.role, `${prefix}.role`),
    directive: asString(profile?.directive),
    origin: asString(profile?.origin, "internal"),
    persona: asString(profile?.persona),
    memorySummary: asString(profile?.memorySummary),
    capabilityProfile: {
      skills: asStringArray(profile?.capabilityProfile?.skills),
      tools: asStringArray(profile?.capabilityProfile?.tools),
      preferredTasks: asStringArray(profile?.capabilityProfile?.preferredTasks),
      forbiddenTasks: asStringArray(profile?.capabilityProfile?.forbiddenTasks),
      resourceNeeds: asStringArray(profile?.capabilityProfile?.resourceNeeds)
    }
  };
}

function validateChannel(sourceName, channel, index) {
  const prefix = `channels[${index}]`;
  return {
    id: requireString(sourceName, channel?.id, `${prefix}.id`),
    name: asString(channel?.name, channel?.id || ""),
    mode: asString(channel?.mode, "group"),
    members: asStringArray(channel?.members),
    metadata: channel?.metadata && typeof channel.metadata === "object" ? channel.metadata : {}
  };
}

function validateInitialMessage(sourceName, message, index) {
  const prefix = `initialMessages[${index}]`;
  return {
    from: requireString(sourceName, message?.from, `${prefix}.from`),
    channelId: requireString(sourceName, message?.channelId, `${prefix}.channelId`),
    type: requireString(sourceName, message?.type, `${prefix}.type`),
    text: asString(message?.text),
    content: Array.isArray(message?.content) ? message.content : [],
    replyTo: asString(message?.replyTo),
    metadata: message?.metadata && typeof message.metadata === "object" ? message.metadata : {}
  };
}

function validateDefaultLaunch(sourceName, value) {
  if (!value || typeof value !== "object") {
    return {
      namePrefix: "",
      observerTemplate: "",
      observerTemplates: [],
      observerViews: [],
      note: ""
    };
  }

  return {
    namePrefix: asString(value.namePrefix),
    observerTemplate: asString(value.observerTemplate),
    observerTemplates: asStringArray(value.observerTemplates),
    observerViews: Array.isArray(value.observerViews)
      ? value.observerViews
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            templateId: asString(item.templateId || item.observerTemplate || item.id),
            port: typeof item.port === "number" ? item.port : item.observerPort
          }))
          .filter((item) => item.templateId)
      : [],
    note: asString(value.note)
  };
}

function validateVisualCartridge(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return {
    brand: asString(value.brand, "COSMOS"),
    title: asString(value.title),
    subtitle: asString(value.subtitle),
    badge: asString(value.badge),
    code: asString(value.code),
    motif: asString(value.motif),
    asset: asString(value.asset)
  };
}

function validateVisualSpec(value) {
  if (!value || typeof value !== "object") {
    return {
      cartridge: null
    };
  }

  return {
    cartridge: validateVisualCartridge(value.cartridge)
  };
}

export function validateScenarioSpec(rawSpec, sourceName = "unknown") {
  if (!rawSpec || typeof rawSpec !== "object") {
    fail(sourceName, "spec_must_be_object");
  }

  const profiles = Array.isArray(rawSpec.profiles)
    ? rawSpec.profiles.map((profile, index) => validateProfile(sourceName, profile, index))
    : fail(sourceName, "profiles_required");

  if (!profiles.length) {
    fail(sourceName, "profiles_empty");
  }

  const channels = Array.isArray(rawSpec.channels)
    ? rawSpec.channels.map((channel, index) => validateChannel(sourceName, channel, index))
    : fail(sourceName, "channels_required");

  if (!channels.length) {
    fail(sourceName, "channels_empty");
  }

  return {
    id: requireString(sourceName, rawSpec.id, "id"),
    name: requireString(sourceName, rawSpec.name, "name"),
    description: asString(rawSpec.description),
    worldPrompt: asString(rawSpec.worldPrompt, asString(rawSpec.description)),
    workspaceName: asString(rawSpec.workspaceName, rawSpec.name),
    recommendedObserverTemplate: asString(rawSpec.recommendedObserverTemplate, "chat"),
    recommendedObserverTemplates: asStringArray(rawSpec.recommendedObserverTemplates),
    version: asString(rawSpec.version, "1"),
    status: asString(rawSpec.status, "active"),
    authors: asStringArray(rawSpec.authors),
    seedSummary: asString(rawSpec.seedSummary),
    notes: asString(rawSpec.notes),
    readmePath: asStringOrNull(rawSpec.readmePath),
    tags: asStringArray(rawSpec.tags),
    highlights: asStringArray(rawSpec.highlights),
    starterPrompt: asString(rawSpec.starterPrompt),
    worldType: asString(rawSpec.worldType, "general"),
    registrationTriggerRecipients: asStringArray(rawSpec.registrationTriggerRecipients),
    defaultLaunch: validateDefaultLaunch(sourceName, rawSpec.defaultLaunch),
    visual: validateVisualSpec(rawSpec.visual),
    channelBlueprints: Array.isArray(rawSpec.channelBlueprints) ? rawSpec.channelBlueprints : [],
    profiles,
    channels,
    initialMessages: Array.isArray(rawSpec.initialMessages)
      ? rawSpec.initialMessages.map((message, index) =>
          validateInitialMessage(sourceName, message, index)
        )
      : []
  };
}
