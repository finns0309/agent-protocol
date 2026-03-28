import { statusLabel } from "../../lib/workshop-ui.js";

export function PolisHero({ launch, displayName, description }) {
  const isRunning = launch?.status === "running";
  const isStarting = launch?.status === "starting";

  return (
    <>
      <div className={`status-badge ${isRunning ? "is-live" : isStarting ? "is-starting" : "is-ended"}`}>
        {isRunning ? <span className="status-dot" /> : null}
        <span>{statusLabel(launch)}</span>
      </div>

      <h1 className="focus-title focus-title-serif" key={launch?.id}>
        {displayName}
      </h1>
      <p className="focus-copy polis-focus-copy" key={`${launch?.id}-copy`}>
        {description}
      </p>
    </>
  );
}
