import { MythosSpotlight } from "../components/mythos/MythosSpotlight.jsx";
import { MythosCatalogCard } from "../components/mythos/MythosCatalogCard.jsx";
import { showcaseMetaForScenario, splitScenariosForShowcase } from "../lib/workshop-ui.js";

export function MythosStore({
  scenarios,
  selectedMythosId,
  themeForScenario,
  templates,
  launches,
  launchDrafts,
  onSelectMythos,
  onOpenLaunch
}) {
  const selectedMythos =
    scenarios.find((scenario) => scenario.id === selectedMythosId) ||
    scenarios[0] ||
    null;
  const { featured, rest } = splitScenariosForShowcase(scenarios);

  if (!selectedMythos) {
    return (
      <section className="screen-mythos screen-mythos-empty">
        <div className="focus-kicker">Mythos</div>
        <h1 className="focus-title focus-title-serif">No Mythos yet</h1>
        <p className="focus-copy">A Mythos is a blueprint for a world before it exists.</p>
      </section>
    );
  }

  return (
    <section className="screen-mythos screen-mythos-prototype">
      <div className="mythos-prototype-head">
        <div className="focus-kicker">Mythos</div>
        <h1 className="focus-title focus-title-serif">Mythos</h1>
        <p className="focus-copy">Blueprints for autonomous worlds before they come alive.</p>
        <p className="focus-copy focus-copy-compact">
          Restarting the same mythos does not replay a fixed script. Each run can diverge into a different trajectory.
        </p>
      </div>

      <div className="mythos-showcase-grid">
        <MythosSpotlight
          mythos={selectedMythos}
          theme={themeForScenario(selectedMythos.id)}
          templates={templates}
          launches={launches}
          launchDrafts={launchDrafts}
          onOpenLaunch={onOpenLaunch}
          showcaseMeta={showcaseMetaForScenario(selectedMythos.id)}
        />

        <div className="mythos-library">
          <div className="mythos-library-frame">
            <div className="mythos-library-head">
              <div>
                <div className="mythos-library-kicker">Recommended for first demos</div>
                <h2 className="mythos-library-title">Start with these worlds</h2>
              </div>
            </div>

            <div className="mythos-library-section">
              <div className="mythos-catalog-list">
                {featured.map((scenario) => {
                  const running = launches.some((launch) => launch.scenarioId === scenario.id && launch.status !== "stopped");

                  return (
                    <MythosCatalogCard
                      key={scenario.id}
                      onLaunch={onOpenLaunch}
                      onSelect={onSelectMythos}
                      running={running}
                      scenario={scenario}
                      selected={scenario.id === selectedMythos.id}
                      templates={templates}
                      theme={themeForScenario(scenario.id)}
                      showcaseMeta={showcaseMetaForScenario(scenario.id)}
                    />
                  );
                })}
              </div>
            </div>

            {rest.length ? (
              <div className="mythos-library-section mythos-library-section-secondary">
                <div className="mythos-library-section-head">
                  <div className="mythos-library-section-title">More worlds</div>
                  <div className="mythos-library-section-copy">
                    Additional mythos remain available once the core demo path is clear.
                  </div>
                </div>

                <div className="mythos-catalog-list mythos-catalog-list-secondary">
                  {rest.map((scenario) => {
                    const running = launches.some((launch) => launch.scenarioId === scenario.id && launch.status !== "stopped");

                    return (
                      <MythosCatalogCard
                        key={scenario.id}
                        onLaunch={onOpenLaunch}
                        onSelect={onSelectMythos}
                        running={running}
                        scenario={scenario}
                        selected={scenario.id === selectedMythos.id}
                        templates={templates}
                        theme={themeForScenario(scenario.id)}
                        showcaseMeta={showcaseMetaForScenario(scenario.id)}
                      />
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
