import { Cartridge } from "../Cartridge.jsx";
import { cartridgeDataForScenario } from "../../lib/workshop-ui.js";

export function MythosRail({ scenarios, selectedMythosId, selectedIndex, themeForScenario, launches, onSelectMythos }) {
  return (
    <div className="mythos-carousel">
      {scenarios.length > 1 ? (
        <button
          className="nav-arrow"
          disabled={selectedIndex <= 0}
          onClick={() => onSelectMythos(scenarios[Math.max(0, selectedIndex - 1)].id)}
          type="button"
        >
          ‹
        </button>
      ) : null}

      <div className="mythos-carousel-track">
        {scenarios.map((scenario) => {
          const itemTheme = themeForScenario(scenario.id);
          const itemRunning = launches.some((launch) => launch.scenarioId === scenario.id && launch.status !== "stopped");
          const active = scenario.id === selectedMythosId;

          return (
            <div className={`mythos-carousel-item ${active ? "is-active" : ""}`} key={scenario.id}>
              <Cartridge
                data={cartridgeDataForScenario(scenario, itemTheme)}
                size={active ? "lg" : "md"}
                isSelected={active}
                isActive={itemRunning}
                onClick={() => onSelectMythos(scenario.id)}
              />
              <div className="mythos-carousel-label">{scenario.name}</div>
            </div>
          );
        })}
      </div>

      {scenarios.length > 1 ? (
        <button
          className="nav-arrow"
          disabled={selectedIndex >= scenarios.length - 1}
          onClick={() => onSelectMythos(scenarios[Math.min(scenarios.length - 1, selectedIndex + 1)].id)}
          type="button"
        >
          ›
        </button>
      ) : null}
    </div>
  );
}
