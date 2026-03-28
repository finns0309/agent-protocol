import { startTransition } from "react";

export const TABS = [
  { id: "worlds", label: "Polis", icon: "P" },
  { id: "templates", label: "Mythos", icon: "M" },
  { id: "history", label: "Archive", icon: "A" }
];

export const CARTRIDGE_THEMES = [
  { color: "#6B8F5E", colorDark: "#3D5A32", glow: "rgba(107, 143, 94, 0.26)" },
  { color: "#5C6B7A", colorDark: "#2D3A47", glow: "rgba(92, 107, 122, 0.22)" },
  { color: "#4A6B5A", colorDark: "#1E3A2A", glow: "rgba(74, 107, 90, 0.22)" },
  { color: "#7A6B5C", colorDark: "#4A3D2E", glow: "rgba(122, 107, 92, 0.2)" },
  { color: "#8B7355", colorDark: "#5A4830", glow: "rgba(139, 115, 85, 0.22)" },
  { color: "#6B5C7A", colorDark: "#3D2E4A", glow: "rgba(107, 92, 122, 0.22)" },
  { color: "#5A6B7A", colorDark: "#2A3D4E", glow: "rgba(90, 107, 122, 0.22)" }
];

export const SHOWCASE_SCENARIO_ORDER = [
  "community-agent-market",
  "context-sync-network",
  "signal-war-room"
];

const SHOWCASE_SCENARIO_META = {
  "community-agent-market": {
    label: "External Handoff",
    promise:
      "An external request enters the world, specialist agents self-select into the work, and the flow moves into a focused execution channel."
  },
  "context-sync-network": {
    label: "Multi-Agent Network",
    promise:
      "Multiple external agents join the same world, exchange updates, and decide what context is worth sharing across the network."
  },
  "signal-war-room": {
    label: "Practical Coordination",
    promise:
      "A concrete anomaly triggers triage, analysis, delegation, and next-step planning in a way that feels immediately legible to internal teams."
  }
};

function readTemplateId(value) {
  return String(value?.templateId || value?.observerTemplate || value?.id || "").trim();
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function defaultObserverViewsForScenario(index, scenario) {
  const defaultLaunch = scenario?.defaultLaunch || {};
  const baseObserverPort = 4285 + index * 10;
  const explicitViews = Array.isArray(defaultLaunch.observerViews)
    ? defaultLaunch.observerViews
        .filter((view) => readTemplateId(view))
        .map((view, viewIndex) => ({
          templateId: readTemplateId(view),
          port: String(Number(view?.port ?? view?.observerPort) || baseObserverPort + viewIndex)
        }))
    : [];

  if (explicitViews.length) {
    return [explicitViews[0]];
  }

  const templateIds = uniqueStrings([
    ...(Array.isArray(defaultLaunch.observerTemplates) ? defaultLaunch.observerTemplates : []),
    defaultLaunch.observerTemplate,
    ...(Array.isArray(scenario?.recommendedObserverTemplates) ? scenario.recommendedObserverTemplates : []),
    scenario?.recommendedObserverTemplate,
    "chat"
  ]);

  const primaryTemplateId = templateIds[0] || "chat";
  return [
    {
      templateId: primaryTemplateId,
      port: String(baseObserverPort)
    }
  ];
}

export function createDefaultDraft(index, scenario) {
  const observerViews = defaultObserverViewsForScenario(index, scenario);
  return {
    name: "",
    serverPort: String(4291 + index * 10),
    observerTemplate: observerViews[0]?.templateId || scenario?.recommendedObserverTemplate || "chat",
    observerPort: observerViews[0]?.port || String(4285 + index * 10),
    observerViews
  };
}

export function normalizeLaunchDraft(draft, index, scenario) {
  const fallback = createDefaultDraft(index, scenario);
  const hasExplicitObserverViews = Array.isArray(draft?.observerViews);
  const currentViews =
    hasExplicitObserverViews
      ? draft.observerViews
      : draft?.observerTemplate
        ? [
            {
              templateId: draft.observerTemplate,
              port: String(draft.observerPort || fallback.observerPort)
            }
          ]
        : fallback.observerViews;

  const observerViews = currentViews
    .map((view, viewIndex) => ({
      templateId: readTemplateId(view),
      port: String(view?.port ?? view?.observerPort ?? fallback.observerViews[viewIndex]?.port ?? Number(fallback.observerPort) + viewIndex)
    }))
    .filter((view) => view.templateId);

  return {
    ...fallback,
    ...draft,
    observerTemplate: observerViews[0]?.templateId || fallback.observerTemplate,
    observerPort: observerViews[0]?.port || fallback.observerPort,
    observerViews
  };
}

export function mergeLaunchDrafts(currentDrafts, scenarios) {
  const nextDrafts = { ...currentDrafts };
  scenarios.forEach((scenario, index) => {
    nextDrafts[scenario.id] = normalizeLaunchDraft(nextDrafts[scenario.id], index, scenario);
  });
  return nextDrafts;
}

export function showcaseMetaForScenario(scenarioId) {
  return SHOWCASE_SCENARIO_META[scenarioId] || null;
}

export function sortScenariosForShowcase(scenarios = []) {
  const priority = new Map(SHOWCASE_SCENARIO_ORDER.map((scenarioId, index) => [scenarioId, index]));
  return [...scenarios].sort((left, right) => {
    const leftPriority = priority.has(left.id) ? priority.get(left.id) : Number.MAX_SAFE_INTEGER;
    const rightPriority = priority.has(right.id) ? priority.get(right.id) : Number.MAX_SAFE_INTEGER;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return String(left.name || left.id).localeCompare(String(right.name || right.id));
  });
}

export function splitScenariosForShowcase(scenarios = []) {
  const featured = [];
  const rest = [];

  for (const scenario of scenarios) {
    if (SHOWCASE_SCENARIO_META[scenario.id]) {
      featured.push(scenario);
    } else {
      rest.push(scenario);
    }
  }

  return { featured, rest };
}

export function fetchJson(pathname, init = {}) {
  return fetch(pathname, init).then(async (response) => {
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json?.message || json?.error || `request_failed:${response.status}`);
    }
    return json;
  });
}

export function themeForIndex(index) {
  return CARTRIDGE_THEMES[index % CARTRIDGE_THEMES.length];
}

export function makeInitials(value) {
  return String(value || "")
    .split(/[\s-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() || "")
    .join("") || "CW";
}

function normalizeCartridgeVisual(visual = {}) {
  return {
    brand: String(visual?.brand || "COSMOS").trim() || "COSMOS",
    title: String(visual?.title || "").trim(),
    subtitle: String(visual?.subtitle || "").trim(),
    badge: String(visual?.badge || "").trim(),
    code: String(visual?.code || "").trim(),
    motif: String(visual?.motif || "default").trim() || "default",
    asset: String(visual?.asset || "").trim()
  };
}

export function cartridgeDataForScenario(scenario, theme) {
  const visual = normalizeCartridgeVisual(scenario?.visual?.cartridge || {});
  const fallbackName = String(scenario?.defaultLaunch?.namePrefix || scenario?.name || "").trim();

  return {
    theme,
    brand: visual.brand,
    title: visual.title || fallbackName,
    subtitle: visual.subtitle || formatWorldType(scenario?.worldType || ""),
    badge: visual.badge || "",
    code: visual.code || makeInitials(fallbackName),
    motif: visual.motif,
    asset: visual.asset,
    shortLabel: makeInitials(fallbackName)
  };
}

export function cartridgeDataForLaunch(launch, scenario, theme) {
  const fallbackName = String(scenario?.name || launch?.scenarioName || launch?.name || "").trim();
  if (!scenario) {
    return {
      theme,
      brand: "COSMOS",
      title: fallbackName,
      subtitle: "",
      badge: "",
      code: makeInitials(fallbackName),
      motif: "default",
      asset: "",
      shortLabel: makeInitials(fallbackName)
    };
  }

  return cartridgeDataForScenario(
    {
      ...scenario,
      name: fallbackName
    },
    theme
  );
}

export function formatClock() {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

export function formatUptime(value) {
  if (!value) {
    return "just now";
  }
  const diffMinutes = Math.max(1, Math.round((Date.now() - Number(value)) / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function templateLabel(templates, templateId) {
  return templates.find((entry) => entry.id === templateId)?.name || templateId;
}

export function templateLabels(templates, templateIds = []) {
  return uniqueStrings(templateIds).map((templateId) => templateLabel(templates, templateId));
}

export function formatWorldType(value) {
  return String(value || "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((token) => token[0]?.toUpperCase() + token.slice(1))
    .join(" ");
}

export function statusLabel(launch) {
  if (!launch) {
    return "";
  }
  if (launch.status === "running") {
    return `live · ${formatUptime(launch.createdAt)}`;
  }
  if (launch.status === "starting") {
    return "starting";
  }
  if (launch.status === "stopped") {
    return "ended";
  }
  return launch.status || "";
}

export function launchDisplayName(launch, scenario) {
  if (!launch) {
    return "";
  }
  const currentName = String(launch.name || "").trim();
  const scenarioName = String(scenario?.name || launch.scenarioName || "").trim();
  const legacyPrefix = String(scenario?.defaultLaunch?.namePrefix || "").trim();

  if (!currentName) {
    return scenarioName;
  }
  if (legacyPrefix && currentName === legacyPrefix && scenarioName) {
    return scenarioName;
  }
  return currentName;
}

export function formatDateTime(value) {
  if (!value) {
    return "just now";
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(Number(value)));
}

export function formatDuration(startedAt, endedAt) {
  const start = Number(startedAt || 0);
  const end = Number(endedAt || 0);
  if (!start || !end || end <= start) {
    return "just now";
  }
  const diffMinutes = Math.max(1, Math.round((end - start) / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function sortLaunches(launches = []) {
  const weight = {
    running: 0,
    starting: 1,
    stopped: 2,
    failed: 3
  };

  return [...launches].sort((left, right) => {
    const leftWeight = weight[left.status] ?? 9;
    const rightWeight = weight[right.status] ?? 9;
    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }
    return Number(right.updatedAt || right.createdAt || 0) - Number(left.updatedAt || left.createdAt || 0);
  });
}

export function withViewTransition(callback) {
  if (typeof document !== "undefined" && typeof document.startViewTransition === "function") {
    document.startViewTransition(() => {
      startTransition(callback);
    });
    return;
  }
  startTransition(callback);
}
