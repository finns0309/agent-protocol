import { useEffect, useState } from "react";
import { PolisHero } from "../components/polis/PolisHero.jsx";
import { PolisRail } from "../components/polis/PolisRail.jsx";
import { launchDisplayName, templateLabel } from "../lib/workshop-ui.js";

export function PolisShelf({
  launches,
  selectedLaunch,
  selectedIndex,
  scenarioById,
  themeForScenario,
  templates,
  onSelectLaunch,
  onShift,
  onOpenMythos,
  onStop,
  onRestart
}) {
  if (!selectedLaunch) {
    return (
      <section className="screen-polis is-empty">
        <div className="focus-kicker">Polis</div>
        <h1 className="focus-title">No Polis yet</h1>
        <p className="focus-copy">Launch a Mythos to bring a world to life.</p>
        <button className="button button-secondary" onClick={onOpenMythos} type="button">
          Open Mythos Library
        </button>
      </section>
    );
  }

  const scenario = scenarioById.get(selectedLaunch.scenarioId) || null;
  const displayName = launchDisplayName(selectedLaunch, scenario);
  const description = scenario?.description || selectedLaunch.scenarioName;
  const [copiedManifest, setCopiedManifest] = useState(false);
  const manifestUrl = selectedLaunch.urls?.manifest || (selectedLaunch.urls?.networkApi ? `${selectedLaunch.urls.networkApi.replace(/\/$/, "")}/api/manifest` : "");

  useEffect(() => {
    setCopiedManifest(false);
  }, [selectedLaunch.id]);

  useEffect(() => {
    if (!copiedManifest) {
      return undefined;
    }
    const timer = window.setTimeout(() => setCopiedManifest(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copiedManifest]);

  async function handleCopyManifest() {
    if (!manifestUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(manifestUrl);
      setCopiedManifest(true);
    } catch {
      setCopiedManifest(false);
    }
  }

  const observerViews =
    Array.isArray(selectedLaunch.observerViews) && selectedLaunch.observerViews.length
      ? selectedLaunch.observerViews.map((view) => ({
          id: view.templateId || view.id,
          label: view.name || templateLabel(templates, view.templateId || view.id),
          port: view.port,
          url: view.url || selectedLaunch.urls?.observers?.[view.templateId || view.id] || ""
        }))
      : selectedLaunch.observerTemplate
        ? [
            {
              id: selectedLaunch.observerTemplate,
              label: templateLabel(templates, selectedLaunch.observerTemplate),
              port: selectedLaunch.observerPort,
              url: selectedLaunch.urls?.observer || ""
            }
          ]
        : [];
  const stats = [
    {
      value: scenario?.profileCount || scenario?.profiles?.length || selectedLaunch.overview?.topAgents?.length || "—",
      label: "agents"
    },
    {
      value:
        scenario?.channelBlueprints?.length ||
        selectedLaunch.overview?.activeChannelCount ||
        selectedLaunch.overview?.channelCount ||
        "—",
      label: "channels"
    },
    {
      value: observerViews.length || "—",
      label: observerViews.length === 1 ? "view" : "views"
    }
  ];

  return (
    <section className="screen-polis screen-polis-prototype">
      <PolisHero description={description} displayName={displayName} launch={selectedLaunch} />

      <div className="polis-prototype-stats" key={`${selectedLaunch.id}-stats`}>
        {stats.map((stat) => (
          <div className="polis-prototype-stat" key={stat.label}>
            <div className={`polis-prototype-stat-value ${stat.isText ? "is-text" : ""}`}>{stat.value}</div>
            <div className="polis-prototype-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="polis-prototype-actions" key={`${selectedLaunch.id}-actions`}>
        {selectedLaunch.urls?.observer ? (
          <a className="polis-prototype-button is-primary" href={selectedLaunch.urls.observer} rel="noreferrer" target="_blank">
            Observe
          </a>
        ) : (
          <button className="polis-prototype-button is-primary" disabled type="button">
            Observe
          </button>
        )}

        <button className="polis-prototype-button is-secondary" onClick={() => onStop(selectedLaunch.id)} type="button">
          Pause
        </button>
      </div>

      <div className="polis-prototype-ports">
        <button
          className={`polis-port-pill polis-port-copy ${copiedManifest ? "is-copied" : ""}`}
          disabled={!manifestUrl}
          onClick={handleCopyManifest}
          title={manifestUrl || "Manifest unavailable"}
          type="button"
        >
          <span className="polis-port-label">{copiedManifest ? "Copied" : "Server"}</span>
          <span className="polis-port-value">{copiedManifest ? "manifest" : selectedLaunch.serverPort || "—"}</span>
        </button>
        {observerViews.map((view) =>
          view.url ? (
            <a className="polis-port-pill is-link" href={view.url} key={view.id} rel="noreferrer" target="_blank">
              <span className="polis-port-label">{view.label}</span>
              <span className="polis-port-value">{view.port || "—"}</span>
            </a>
          ) : (
            <div className="polis-port-pill" key={view.id}>
              <span className="polis-port-label">{view.label}</span>
              <span className="polis-port-value">{view.port || "—"}</span>
            </div>
          )
        )}
      </div>

      <PolisRail
        launches={launches}
        onOpenMythos={onOpenMythos}
        onSelectLaunch={onSelectLaunch}
        onShift={onShift}
        scenarioById={scenarioById}
        selectedIndex={selectedIndex}
        themeForScenario={themeForScenario}
      />
    </section>
  );
}
