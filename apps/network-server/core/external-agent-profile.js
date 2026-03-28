function uniqueAllowed(values, allowedValues) {
  const allowed = new Set(allowedValues);
  const source = Array.isArray(values) ? values : [];
  return Array.from(new Set(source.filter((value) => allowed.has(value))));
}

function normalizePositiveNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const ExternalWakeCapabilities = {
  EVENT: "event",
  TIME: "time",
  POLL: "poll"
};

export const ExternalPresenceModes = {
  ONLINE: "online",
  OFFLINE: "offline",
  HYBRID: "hybrid"
};

export const ExternalExecutionModes = {
  MAIN_SESSION_SILENT: "main_session_silent",
  ISOLATED_SESSION: "isolated_session",
  OWNER_REVIEW: "owner_review",
  POLL_ONLY: "poll_only"
};

export const ExternalDecisionModes = {
  AUTONOMOUS: "autonomous",
  OWNER_REVIEW: "owner_review",
  MANUAL: "manual"
};

function inferPresenceMode(wakeCapabilities) {
  const hasEvent = wakeCapabilities.includes(ExternalWakeCapabilities.EVENT);
  const hasBackgroundWake = wakeCapabilities.some((capability) =>
    [ExternalWakeCapabilities.TIME, ExternalWakeCapabilities.POLL].includes(capability)
  );

  if (hasEvent && hasBackgroundWake) {
    return ExternalPresenceModes.HYBRID;
  }
  if (hasEvent) {
    return ExternalPresenceModes.ONLINE;
  }
  return ExternalPresenceModes.OFFLINE;
}

function inferDecisionMode(defaultMode) {
  if ([ExternalExecutionModes.MAIN_SESSION_SILENT, ExternalExecutionModes.ISOLATED_SESSION].includes(defaultMode)) {
    return ExternalDecisionModes.AUTONOMOUS;
  }
  if (defaultMode === ExternalExecutionModes.OWNER_REVIEW) {
    return ExternalDecisionModes.OWNER_REVIEW;
  }
  return ExternalDecisionModes.MANUAL;
}

export function normalizeExternalAgentMetadata(metadata = {}) {
  const safeMetadata = isPlainObject(metadata) ? metadata : {};
  const baseProfile = isPlainObject(safeMetadata.externalProfile) ? safeMetadata.externalProfile : {};
  const wakeCapabilities = uniqueAllowed(baseProfile.wakeCapabilities, Object.values(ExternalWakeCapabilities));
  const executionModes = uniqueAllowed(baseProfile.executionModes, Object.values(ExternalExecutionModes));
  const defaultExecutionModes = executionModes.length ? executionModes : [ExternalExecutionModes.OWNER_REVIEW];
  const requestedDefaultMode = String(baseProfile.defaultMode || "").trim();
  const defaultMode = defaultExecutionModes.includes(requestedDefaultMode)
    ? requestedDefaultMode
    : defaultExecutionModes[0];
  const requestedPresenceMode = String(baseProfile.presenceMode || "").trim();
  const presenceMode = Object.values(ExternalPresenceModes).includes(requestedPresenceMode)
    ? requestedPresenceMode
    : inferPresenceMode(wakeCapabilities);
  const requestedDecisionMode = String(baseProfile.decisionMode || "").trim();
  const decisionMode = Object.values(ExternalDecisionModes).includes(requestedDecisionMode)
    ? requestedDecisionMode
    : inferDecisionMode(defaultMode);

  return {
    ...safeMetadata,
    external: true,
    externalProfile: {
      connectorType: String(baseProfile.connectorType || "").trim(),
      wakeCapabilities: wakeCapabilities.length ? wakeCapabilities : [ExternalWakeCapabilities.POLL],
      executionModes: defaultExecutionModes,
      defaultMode,
      presenceMode,
      decisionMode,
      heartbeatMinutes: normalizePositiveNumber(baseProfile.heartbeatMinutes),
      notes: String(baseProfile.notes || "").trim()
    }
  };
}

export function mergeExternalAgentMetadata(existingMetadata = {}, incomingMetadata = {}) {
  const safeExisting = isPlainObject(existingMetadata) ? existingMetadata : {};
  const safeIncoming = isPlainObject(incomingMetadata) ? incomingMetadata : {};
  return normalizeExternalAgentMetadata({
    ...safeExisting,
    ...safeIncoming,
    externalProfile: {
      ...(isPlainObject(safeExisting.externalProfile) ? safeExisting.externalProfile : {}),
      ...(isPlainObject(safeIncoming.externalProfile) ? safeIncoming.externalProfile : {})
    }
  });
}

export function buildExternalAgentProfileManifest() {
  return {
    metadataShape: {
      external: true,
      externalProfile: {
        connectorType: "string_optional",
        wakeCapabilities: ["event|time|poll"],
        executionModes: ["main_session_silent|isolated_session|owner_review|poll_only"],
        defaultMode: "main_session_silent|isolated_session|owner_review|poll_only",
        presenceMode: "online|offline|hybrid_optional",
        decisionMode: "autonomous|owner_review|manual_optional",
        heartbeatMinutes: "number_optional",
        notes: "string_optional"
      }
    },
    defaults: {
      wakeCapabilities: ["poll"],
      executionModes: ["owner_review"],
      defaultMode: "owner_review",
      presenceMode: "offline",
      decisionMode: "owner_review"
    },
    guidance: [
      "wakeCapabilities describes whether the connector can be awakened by event, time, or poll.",
      "executionModes describes which execution contexts are allowed after a trigger wakes the connector.",
      "defaultMode is the connector's default handling mode.",
      "presenceMode is a coarse online-state declaration for other agents and observers. It does not equal a live connection count."
    ]
  };
}
