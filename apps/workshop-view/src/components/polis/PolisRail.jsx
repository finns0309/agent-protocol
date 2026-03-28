import { AddSlot } from "../AddSlot.jsx";
import { Cartridge } from "../Cartridge.jsx";
import { cartridgeDataForLaunch, launchDisplayName } from "../../lib/workshop-ui.js";

export function PolisRail({
  launches,
  selectedIndex,
  scenarioById,
  themeForScenario,
  onSelectLaunch,
  onShift,
  onOpenMythos
}) {
  return (
    <div className="polis-carousel">
      {launches.length > 1 ? (
        <button className="nav-arrow" disabled={selectedIndex === 0} onClick={() => onShift(-1)} type="button">
          ‹
        </button>
      ) : null}

      <div className="polis-carousel-track">
        {launches.map((launch, index) => {
          const launchScenario = scenarioById.get(launch.scenarioId);
          const itemTheme = themeForScenario(launch.scenarioId);
          const active = index === selectedIndex;
          const itemDisplayName = launchDisplayName(launch, launchScenario);
          return (
            <div className={`polis-carousel-item ${active ? "is-active" : ""}`} key={launch.id}>
              <Cartridge
                data={cartridgeDataForLaunch(launch, launchScenario, itemTheme)}
                size={active ? "lg" : "md"}
                isActive={launch.status === "running"}
                isSelected={active}
                onClick={() => onSelectLaunch(launch.id)}
              />
              <span className="polis-carousel-label">{itemDisplayName}</span>
            </div>
          );
        })}

        <div className="polis-carousel-item is-add">
          <AddSlot onClick={onOpenMythos} />
        </div>
      </div>

      {launches.length > 1 ? (
        <button className="nav-arrow" disabled={selectedIndex >= launches.length - 1} onClick={() => onShift(1)} type="button">
          ›
        </button>
      ) : null}
    </div>
  );
}
