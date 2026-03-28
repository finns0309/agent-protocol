import { Cartridge } from "./Cartridge.jsx";
import { cartridgeDataForScenario } from "../lib/workshop-ui.js";

export function LaunchProgressOverlay({ scenario, theme, phase }) {
  if (!scenario) {
    return null;
  }

  const phaseText = phase === "insert" ? "Preparing Mythos..." : phase === "deploying" ? "Bringing Polis to life..." : "World is live";

  return (
    <div className="launch-progress-overlay">
      <div className="launch-progress-card">
        <div className="launch-progress-cartridge">
          <Cartridge data={cartridgeDataForScenario(scenario, theme)} size="lg" className="is-static" />
        </div>
        <div className="launch-progress-body">
          <div className="launch-progress-title">{scenario.name}</div>
          <div className="launch-progress-phase">{phaseText}</div>
          {phase !== "done" ? (
            <div className="launch-progress-dots">
              <span />
              <span />
              <span />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
