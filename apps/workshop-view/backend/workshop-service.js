import { createScenarioRegistry } from "../../network-server/core/scenario-registry.js";
import { LaunchManager } from "../launch-manager.js";
import { fetchLaunchOverview } from "./launch-overview.js";
import { createObserverTemplateRegistry } from "./observer-template-registry.js";

function createScenarioLookup(scenarios) {
  return new Map(scenarios.map((scenario) => [scenario.id, scenario]));
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

function readTemplateId(value) {
  return String(
    value?.templateId ||
      value?.observerTemplate ||
      value?.id ||
      ""
  ).trim();
}

function resolveDefaultObserverViews(scenario) {
  const defaultLaunch = scenario?.defaultLaunch || {};
  const explicitViews = Array.isArray(defaultLaunch.observerViews)
    ? defaultLaunch.observerViews.filter((view) => readTemplateId(view))
    : [];

  if (explicitViews.length) {
    const primaryView = explicitViews[0];
    return [
      {
        templateId: readTemplateId(primaryView),
        port: primaryView?.port ?? primaryView?.observerPort
      }
    ];
  }

  const templateIds = uniqueStrings([
    ...(Array.isArray(defaultLaunch.observerTemplates) ? defaultLaunch.observerTemplates : []),
    defaultLaunch.observerTemplate,
    ...(Array.isArray(scenario?.recommendedObserverTemplates) ? scenario.recommendedObserverTemplates : []),
    scenario?.recommendedObserverTemplate,
    "chat"
  ]);

  return [{ templateId: templateIds[0] || "chat" }];
}

export class WorkshopService {
  constructor({
    scenarioRegistry = createScenarioRegistry(),
    observerTemplateRegistry = createObserverTemplateRegistry()
  } = {}) {
    this.scenarioRegistry = scenarioRegistry;
    this.observerTemplateRegistry = observerTemplateRegistry;
    this.launchManager = new LaunchManager({
      observerTemplateRegistry
    });
  }

  listScenarios() {
    return this.scenarioRegistry.list();
  }

  getScenario(scenarioId) {
    return this.scenarioRegistry.getSpec(scenarioId);
  }

  listTemplates() {
    return this.observerTemplateRegistry.list();
  }

  async listLaunches() {
    const launches = this.launchManager.listLaunches();
    const overviews = await Promise.all(
      launches.map(async (launch) => [launch.id, await fetchLaunchOverview(launch)])
    );
    const overviewById = new Map(overviews);
    return launches.map((launch) => ({
      ...launch,
      overview: overviewById.get(launch.id) || null
    }));
  }

  async getLaunch(launchId) {
    const launch = this.launchManager.getLaunchRecord(launchId);
    if (!launch) {
      return null;
    }

    const scenario = this.getScenario(launch.scenarioId);
    const templateList = this.observerTemplateRegistry.list();
    const templateById = new Map(templateList.map((item) => [item.id, item]));
    const templates = (launch.observerViews || [])
      .map((view) => templateById.get(view.templateId) || null)
      .filter(Boolean);

    return {
      ...launch,
      scenario,
      template: templates[0] || null,
      templates,
      overview: await fetchLaunchOverview(launch)
    };
  }

  async getBootstrap() {
    return {
      scenarios: this.listScenarios(),
      templates: this.listTemplates(),
      launches: await this.listLaunches()
    };
  }

  async launchWorld({ scenarioId, name = "", serverPort, observerTemplate, observerPort, observerViews }) {
    const scenarios = this.listScenarios();
    const scenarioById = createScenarioLookup(scenarios);
    const scenario = scenarioById.get(scenarioId);
    if (!scenario) {
      throw new Error(`unknown_scenario:${scenarioId || ""}`);
    }

    const defaultLaunch = scenario.defaultLaunch || {};
    const resolvedObserverViews =
      Array.isArray(observerViews) && observerViews.length
        ? observerViews
        : observerTemplate || observerPort
          ? [
              {
                templateId: observerTemplate,
                port: observerPort
              }
            ]
          : resolveDefaultObserverViews(scenario);

    const launch = await this.launchManager.launch({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      observerTemplate:
        observerTemplate ||
        defaultLaunch.observerTemplate ||
        scenario.recommendedObserverTemplate ||
        "chat",
      observerViews: resolvedObserverViews,
      serverPort,
      observerPort,
      name: name || scenario.name || defaultLaunch.namePrefix || ""
    });
    return {
      ...launch,
      overview: await fetchLaunchOverview(launch)
    };
  }

  async stopLaunch(launchId) {
    const launch = await this.launchManager.stopLaunch(launchId);
    return {
      ...launch,
      overview: null
    };
  }

  async restartLaunch(launchId) {
    const launch = await this.launchManager.restartLaunch(launchId);
    return {
      ...launch,
      overview: await fetchLaunchOverview(launch)
    };
  }

  async removeLaunch(launchId) {
    return this.launchManager.removeLaunch(launchId);
  }
}
