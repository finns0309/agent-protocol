import { ArchiveCard } from "../components/archive/ArchiveCard.jsx";

export function ArchiveShelf({ launches, scenarioById, themeForScenario, templates, activeScenarioIds, onRestart, onRemove }) {
  if (!launches.length) {
    return (
      <section className="screen-archive screen-archive-prototype screen-archive-empty">
        <div className="screen-archive-head">
          <div className="focus-kicker">Archive</div>
          <h1 className="focus-title focus-title-serif">Archive</h1>
          <p className="focus-copy">Quiet worlds remain here after the activity ends.</p>
        </div>
      </section>
    );
  }

  const totalMessages = launches.reduce((sum, launch) => sum + Number(launch.overview?.messageCount || 0), 0);
  const uniqueTemplates = new Set(launches.map((launch) => launch.observerTemplate).filter(Boolean)).size;

  return (
    <section className="screen-archive screen-archive-prototype">
      <div className="screen-archive-head">
        <div className="focus-kicker">Archive</div>
        <h1 className="focus-title focus-title-serif">Archive</h1>
        <p className="focus-copy">
          {launches.length} archived {launches.length === 1 ? "world" : "worlds"} · relaunch anytime
        </p>
      </div>

      <div className="archive-list">
        {launches.map((launch) => {
          const scenario = scenarioById.get(launch.scenarioId) || null;
          const theme = themeForScenario(launch.scenarioId);
          const alreadyLive = activeScenarioIds.has(launch.scenarioId);

          return (
            <ArchiveCard
              alreadyLive={alreadyLive}
              key={launch.id}
              launch={launch}
              onRemove={onRemove}
              onRestart={onRestart}
              scenario={scenario}
              templates={templates}
              theme={theme}
            />
          );
        })}
      </div>

      <div className="archive-summary">
        <div className="archive-summary-item">
          <div className="archive-summary-value">{launches.length}</div>
          <div className="archive-summary-label">Archived worlds</div>
        </div>
        <div className="archive-summary-item">
          <div className="archive-summary-value">{totalMessages}</div>
          <div className="archive-summary-label">Messages captured</div>
        </div>
        <div className="archive-summary-item">
          <div className="archive-summary-value">{uniqueTemplates}</div>
          <div className="archive-summary-label">Views used</div>
        </div>
      </div>
    </section>
  );
}
