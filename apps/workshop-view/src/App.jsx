import { useEffect, useState } from "react";
import { loadObserverConfig } from "../../../packages/observer-client/src/browser.js";
import { ConsoleTopBar } from "./components/ConsoleTopBar.jsx";
import { LaunchDialog } from "./components/LaunchDialog.jsx";
import { LaunchProgressOverlay } from "./components/LaunchProgressOverlay.jsx";
import { SwitchDock } from "./components/SwitchDock.jsx";
import { ArchiveShelf } from "./screens/ArchiveShelf.jsx";
import { MythosStore } from "./screens/MythosStore.jsx";
import { PolisShelf } from "./screens/PolisShelf.jsx";
import {
  TABS,
  createDefaultDraft,
  fetchJson,
  formatClock,
  mergeLaunchDrafts,
  normalizeLaunchDraft,
  sortScenariosForShowcase,
  sortLaunches,
  themeForIndex,
  withViewTransition
} from "./lib/workshop-ui.js";

export function App() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [scenarios, setScenarios] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [launches, setLaunches] = useState([]);
  const [launchDrafts, setLaunchDrafts] = useState({});
  const [activeTab, setActiveTab] = useState("worlds");
  const [selectedWorldId, setSelectedWorldId] = useState("");
  const [selectedMythosId, setSelectedMythosId] = useState("");
  const [launchDialogScenarioId, setLaunchDialogScenarioId] = useState("");
  const [launchingState, setLaunchingState] = useState(null);
  const [actingLaunchId, setActingLaunchId] = useState("");

  const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const activeLaunches = launches.filter((launch) => launch.status !== "stopped");
  const archivedLaunches = launches.filter((launch) => launch.status === "stopped");
  const activeScenarioIds = new Set(activeLaunches.map((launch) => launch.scenarioId));

  function themeForScenario(scenarioId) {
    const index = scenarios.findIndex((scenario) => scenario.id === scenarioId);
    return themeForIndex(index < 0 ? 0 : index);
  }

  async function hydrateBootstrap() {
    await loadObserverConfig();

    const bootstrap = await fetchJson("/api/bootstrap");
    const nextScenarios = sortScenariosForShowcase(bootstrap.scenarios || []);
    const nextTemplates = bootstrap.templates || [];
    const nextLaunches = sortLaunches(bootstrap.launches || []);
    setScenarios(nextScenarios);
    setTemplates(nextTemplates);
    setLaunches(nextLaunches);
    setLaunchDrafts((current) => mergeLaunchDrafts(current, nextScenarios));
    setSelectedMythosId((current) =>
      current && nextScenarios.some((scenario) => scenario.id === current) ? current : nextScenarios[0]?.id || ""
    );
    const nextActiveLaunches = nextLaunches.filter((launch) => launch.status !== "stopped");
    setSelectedWorldId((current) =>
      nextActiveLaunches.some((launch) => launch.id === current) ? current : nextActiveLaunches[0]?.id || ""
    );
  }

  useEffect(() => {
    hydrateBootstrap()
      .catch((reason) => {
        setError(reason?.message || "Failed to load Cosmos");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!activeLaunches.length) {
      setSelectedWorldId("");
      return;
    }
    if (!activeLaunches.some((launch) => launch.id === selectedWorldId)) {
      setSelectedWorldId(activeLaunches[0].id);
    }
  }, [activeLaunches, selectedWorldId]);

  async function refreshLaunches(showRefreshing = true) {
    if (showRefreshing) {
      setRefreshing(true);
    }
    try {
      const payload = await fetchJson("/api/launches");
      const nextLaunches = sortLaunches(payload.launches || []);
      setLaunches(nextLaunches);
      const nextActiveLaunches = nextLaunches.filter((launch) => launch.status !== "stopped");
      setSelectedWorldId((current) =>
        nextActiveLaunches.some((launch) => launch.id === current) ? current : nextActiveLaunches[0]?.id || ""
      );
      setError("");
    } catch (reason) {
      setError(reason?.message || "Failed to refresh Cosmos");
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshBootstrap(showRefreshing = true) {
    if (showRefreshing) {
      setRefreshing(true);
    }
    try {
      await hydrateBootstrap();
      setError("");
    } catch (reason) {
      setError(reason?.message || "Failed to refresh Cosmos");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLaunchConfirm(scenarioId) {
    const scenario = scenarioById.get(scenarioId);
    if (!scenario) {
      return;
    }

    const draft = normalizeLaunchDraft(
      launchDrafts[scenarioId] || createDefaultDraft(0, scenario),
      scenarios.findIndex((entry) => entry.id === scenarioId),
      scenario
    );
    const selectedViews = (draft.observerViews || [])
      .map((view) => ({
        templateId: String(view?.templateId || "").trim(),
        port: Number(view?.port)
      }))
      .filter((view) => view.templateId && Number.isInteger(view.port) && view.port > 0);

    if (!selectedViews.length) {
      setError("Choose at least one view");
      return;
    }

    setLaunchDialogScenarioId("");
    setLaunchingState({
      scenarioId,
      phase: "insert"
    });
    setError("");

    const startedAt = Date.now();
    const phaseTimer = window.setTimeout(() => {
      setLaunchingState((current) => (current ? { ...current, phase: "deploying" } : current));
    }, 760);

    try {
      const result = await fetchJson("/api/launches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          scenarioId,
          name: draft.name,
          serverPort: Number(draft.serverPort),
          observerTemplate: selectedViews[0]?.templateId || draft.observerTemplate,
          observerPort: selectedViews[0]?.port || Number(draft.observerPort),
          observerViews: selectedViews
        })
      });

      const payload = await fetchJson("/api/launches");
      const nextLaunches = sortLaunches(payload.launches || []);
      const nextActiveLaunches = nextLaunches.filter((launch) => launch.status !== "stopped");
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1450) {
        await new Promise((resolve) => window.setTimeout(resolve, 1450 - elapsed));
      }

      setLaunchingState({
        scenarioId,
        phase: "done"
      });
      await new Promise((resolve) => window.setTimeout(resolve, 420));

      setLaunches(nextLaunches);
      setSelectedWorldId(result?.launch?.id || nextActiveLaunches[0]?.id || "");
      setActiveTab("worlds");
      setError("");
    } catch (reason) {
      setError(reason?.message || "Failed to launch Polis");
      setLaunchDialogScenarioId(scenarioId);
    } finally {
      window.clearTimeout(phaseTimer);
      setLaunchingState(null);
    }
  }

  async function actOnLaunch(launchId, action) {
    setActingLaunchId(launchId);
    setError("");
    try {
      await fetchJson(`/api/launches/${launchId}/${action}`, {
        method: "POST"
      });
      await refreshLaunches(false);
      setSelectedWorldId(launchId);
    } catch (reason) {
      setError(reason?.message || `Failed to ${action} Polis`);
    } finally {
      setActingLaunchId("");
    }
  }

  async function removeLaunch(launchId) {
    setActingLaunchId(launchId);
    setError("");
    try {
      await fetchJson(`/api/launches/${launchId}`, {
        method: "DELETE"
      });
      await refreshLaunches(false);
    } catch (reason) {
      setError(reason?.message || "Failed to remove archived Polis");
    } finally {
      setActingLaunchId("");
    }
  }

  const selectedLaunch = activeLaunches.find((launch) => launch.id === selectedWorldId) || activeLaunches[0] || null;
  const selectedIndex = selectedLaunch ? activeLaunches.findIndex((launch) => launch.id === selectedLaunch.id) : -1;
  const launchScenario = launchDialogScenarioId ? scenarioById.get(launchDialogScenarioId) : null;
  const launchTheme = launchingState ? themeForScenario(launchingState.scenarioId) : null;
  const isStageTab = activeTab === "worlds";

  function openLaunchDialog(scenarioId) {
    setSelectedMythosId(scenarioId);
    setLaunchDialogScenarioId(scenarioId);
  }

  function updateDraft(scenarioId, field, value) {
    const scenario = scenarioById.get(scenarioId);
    const scenarioIndex = scenarios.findIndex((entry) => entry.id === scenarioId);
    setLaunchDrafts((current) => ({
      ...current,
      [scenarioId]: normalizeLaunchDraft(
        {
          ...(current[scenarioId] || createDefaultDraft(scenarioIndex, scenario)),
          [field]: value
        },
        scenarioIndex,
        scenario
      )
    }));
  }

  function handleTabSelect(tabId) {
    withViewTransition(() => {
      setActiveTab(tabId);
      if (tabId === "templates") {
        setSelectedMythosId("");
      }
    });
  }

  if (loading) {
    return (
      <div className="cosmos-app">
        <div aria-hidden="true" className="cosmos-atmosphere">
          <span className="cosmos-orb is-lime" />
          <span className="cosmos-orb is-sky" />
          <span className="cosmos-orb is-amber" />
          <span className="cosmos-grid" />
        </div>
        <div className="cosmos-shell">
          <ConsoleTopBar liveCount={0} clockText={formatClock()} onRefresh={() => {}} refreshing />
          <main className="cosmos-main cosmos-loading">
            <div className="focus-kicker">Loading</div>
            <h1 className="focus-title focus-title-serif">Cosmos</h1>
            <p className="focus-copy">Creating, observing, and understanding autonomous agent worlds.</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="cosmos-app">
      <div aria-hidden="true" className="cosmos-atmosphere">
        <span className="cosmos-orb is-lime" />
        <span className="cosmos-orb is-sky" />
        <span className="cosmos-orb is-amber" />
        <span className="cosmos-grid" />
      </div>

      <div className="cosmos-shell">
        <ConsoleTopBar
          liveCount={activeLaunches.filter((launch) => launch.status === "running").length}
          clockText={formatClock()}
          onRefresh={() => refreshBootstrap(true)}
          refreshing={refreshing}
        />

        {error ? <div className="error-banner">{error}</div> : null}

        <main className={`cosmos-main ${isStageTab ? "is-stage" : "is-document"}`}>
          {activeTab === "worlds" ? (
            <PolisShelf
              launches={activeLaunches}
              selectedLaunch={selectedLaunch}
              selectedIndex={selectedIndex}
              scenarioById={scenarioById}
              themeForScenario={themeForScenario}
              templates={templates}
              onSelectLaunch={(launchId) => withViewTransition(() => setSelectedWorldId(launchId))}
              onShift={(delta) => {
                const next = selectedIndex + delta;
                if (next < 0 || next >= activeLaunches.length) {
                  return;
                }
                withViewTransition(() => setSelectedWorldId(activeLaunches[next].id));
              }}
              onOpenMythos={() =>
                withViewTransition(() => {
                  setActiveTab("templates");
                  setSelectedMythosId("");
                  setLaunchDialogScenarioId("");
                })
              }
              onStop={(launchId) => actOnLaunch(launchId, "stop")}
              onRestart={(launchId) => actOnLaunch(launchId, "restart")}
            />
          ) : null}

          {activeTab === "templates" ? (
            <MythosStore
              scenarios={scenarios}
              selectedMythosId={selectedMythosId}
              themeForScenario={themeForScenario}
              templates={templates}
              launches={activeLaunches}
              launchDrafts={launchDrafts}
              onSelectMythos={(scenarioId) => withViewTransition(() => setSelectedMythosId(scenarioId))}
              onOpenLaunch={openLaunchDialog}
            />
          ) : null}

          {activeTab === "history" ? (
            <ArchiveShelf
              launches={archivedLaunches}
              scenarioById={scenarioById}
              themeForScenario={themeForScenario}
              templates={templates}
              activeScenarioIds={activeScenarioIds}
              onRestart={(launchId) => actOnLaunch(launchId, "restart")}
              onRemove={removeLaunch}
            />
          ) : null}

        </main>

        <SwitchDock
          activeTab={activeTab}
          archiveCount={archivedLaunches.length}
          onSelectTab={handleTabSelect}
          tabs={TABS}
        />
      </div>

      {launchScenario ? (
        <LaunchDialog
          busy={Boolean(launchingState)}
          scenario={launchScenario}
          draft={launchDrafts[launchScenario.id] || createDefaultDraft(0, launchScenario)}
          theme={themeForScenario(launchScenario.id)}
          templates={templates}
          onCancel={() => setLaunchDialogScenarioId("")}
          onChange={(field, value) => updateDraft(launchScenario.id, field, value)}
          onConfirm={() => handleLaunchConfirm(launchScenario.id)}
        />
      ) : null}

      {launchingState && launchTheme ? (
        <LaunchProgressOverlay
          phase={launchingState.phase}
          scenario={scenarioById.get(launchingState.scenarioId)}
          theme={launchTheme}
        />
      ) : null}

      {actingLaunchId ? <div className="action-toast">{actingLaunchId === selectedWorldId ? "Updating Polis..." : "Working..."}</div> : null}
    </div>
  );
}
