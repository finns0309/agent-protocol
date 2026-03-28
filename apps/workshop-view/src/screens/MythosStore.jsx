import { MythosCatalogCard } from "../components/mythos/MythosCatalogCard.jsx";

export function MythosStore({
  scenarios,
  selectedMythosId,
  themeForScenario,
  templates,
  launches,
  onSelectMythos,
  onOpenLaunch
}) {
  const selectedMythos =
    scenarios.find((scenario) => scenario.id === selectedMythosId) ||
    scenarios[0] ||
    null;

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
      </div>

      <div className="mythos-catalog-list">
        {scenarios.map((scenario) => {
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
            />
          );
        })}
      </div>
    </section>
  );
}
