import { Cartridge } from "../Cartridge.jsx";
import {
  cartridgeDataForLaunch,
  formatDateTime,
  formatDuration,
  launchDisplayName,
  templateLabel
} from "../../lib/workshop-ui.js";

export function ArchiveCard({ launch, scenario, theme, templates, alreadyLive, onRestart, onRemove }) {
  const displayName = launchDisplayName(launch, scenario);
  const worldType = scenario?.worldType || "";

  return (
    <div className="archive-card">
      <Cartridge
        className="is-static is-dimmed"
        data={cartridgeDataForLaunch(launch, scenario, theme)}
        size="sm"
      />
      <div className="archive-card-body">
        <div className="archive-card-title-row">
          <span className="archive-card-title">{displayName}</span>
          {worldType ? <span className="archive-card-subtitle">{worldType}</span> : null}
        </div>
        <div className="archive-card-meta">
          <div>
            <div className="archive-meta-label">Archived</div>
            <div className="archive-meta-value">{formatDateTime(launch.updatedAt || launch.createdAt)}</div>
          </div>
          <div>
            <div className="archive-meta-label">World lifetime</div>
            <div className="archive-meta-value">{formatDuration(launch.createdAt, launch.updatedAt || launch.createdAt)}</div>
          </div>
          <div>
            <div className="archive-meta-label">Lens</div>
            <div className="archive-meta-value">{templateLabel(templates, launch.observerTemplate)}</div>
          </div>
        </div>
      </div>
      <div className="archive-card-actions">
        <button
          className="button button-primary button-compact"
          disabled={alreadyLive}
          onClick={() => onRestart(launch.id)}
          type="button"
        >
          {alreadyLive ? "Already live" : "Relaunch"}
        </button>
        <button className="button button-ghost button-compact" onClick={() => onRemove(launch.id)} type="button">
          Remove
        </button>
      </div>
    </div>
  );
}
