import { Cartridge } from "../Cartridge.jsx";
import { cartridgeDataForScenario, templateLabel } from "../../lib/workshop-ui.js";

export function MythosCatalogCard({ scenario, theme, templates, running, selected, onSelect, onLaunch }) {
  const leadCopy = scenario.seedSummary || scenario.description || "";
  const stats = [
    `${scenario.profileCount || scenario.profiles?.length || 0} agents`,
    `${scenario.channelBlueprints?.length || 0} channels`,
    `${templateLabel(templates, scenario.recommendedObserverTemplate || "chat")} view`
  ].filter(Boolean);

  return (
    <article className={`mythos-catalog-card ${selected ? "is-selected" : ""}`} onClick={() => onSelect(scenario.id)}>
      <div className="mythos-catalog-cartridge">
        <Cartridge
          data={cartridgeDataForScenario(scenario, theme)}
          size="md"
          isActive={running}
          isSelected={selected}
          onClick={() => onSelect(scenario.id)}
        />
      </div>

      <div className="mythos-catalog-copy">
        <div className="mythos-catalog-title-row">
          <span className="mythos-catalog-title">{scenario.name}</span>
          {scenario.worldType ? <span className="mythos-catalog-worldtype">{scenario.worldType}</span> : null}
        </div>

        <p className="mythos-catalog-desc">{leadCopy}</p>

        <div className="mythos-catalog-meta">
          {stats.map((tag) => (
            <span className="mythos-catalog-tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="mythos-catalog-actions">
        {running ? (
          <span className="mythos-catalog-running">Live</span>
        ) : (
          <button
            className="mythos-catalog-launch"
            onClick={(event) => {
              event.stopPropagation();
              onLaunch(scenario.id);
            }}
            type="button"
          >
            Launch Polis
          </button>
        )}
      </div>
    </article>
  );
}
