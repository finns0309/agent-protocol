import { StatPill } from "../StatPill.jsx";
import { templateLabel } from "../../lib/workshop-ui.js";

function PolisPulseCard({ latestEvent, pulseText }) {
  return (
    <div className="polis-pulse-card">
      <div className="polis-section-label">Current Pulse</div>
      <div className="polis-pulse-line">{pulseText}</div>
      {latestEvent?.decisionSummary ? (
        <p className="polis-pulse-copy">{latestEvent.decisionSummary}</p>
      ) : null}
    </div>
  );
}

function PolisMiniList({ title, items, renderItem, emptyText }) {
  return (
    <div className="polis-detail-block">
      <div className="polis-section-label">{title}</div>
      {items.length ? (
        <div className="polis-mini-list">
          {items.map(renderItem)}
        </div>
      ) : (
        <div className="polis-empty-note">{emptyText}</div>
      )}
    </div>
  );
}

function PolisRecentEvents({ events }) {
  if (!events.length) {
    return null;
  }

  return (
    <div className="polis-detail-block polis-detail-block-wide">
      <div className="polis-section-label">Recent Decisions</div>
      <div className="polis-event-list">
        {events.map((event, index) => (
          <div className="polis-event-row" key={`${event.time}-${event.agent}-${index}`}>
            <span className="polis-event-time">{event.time || "now"}</span>
            <span className="polis-event-main">
              {[event.agent || "Someone", event.decisionType || "acted", event.channelLabel ? `in ${event.channelLabel}` : ""]
                .filter(Boolean)
                .join(" ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PolisActionPanel({ launch, stats, templates, topAgents, scenario, onStop, onRestart }) {
  const isRunning = launch.status === "running";
  const overview = launch.overview || null;
  const actionStats = [
    { value: overview?.messageCount ?? "—", label: "messages" },
    {
      value: overview?.activeChannelCount ?? overview?.channelCount ?? scenario?.channelBlueprints?.length ?? "—",
      label: "active channels"
    },
    { value: topAgents[0]?.name || "—", label: "driving", isText: true },
    { value: templateLabel(templates, launch.observerTemplate), label: "view", isText: true }
  ];

  return (
    <aside className="polis-detail-aside">
      <div className="stats-row polis-stats-row" key={`${launch.id}-stats`}>
        {(stats || actionStats).map((stat) => (
          <StatPill key={stat.label} value={stat.value} label={stat.label} isText={stat.isText} />
        ))}
      </div>

      <div className="action-row polis-action-row" key={`${launch.id}-actions`}>
        {isRunning ? (
          <>
            <a className="button button-primary" href={launch.urls?.observer} rel="noreferrer" target="_blank">
              Open
            </a>
            <button className="button button-secondary" onClick={() => onStop(launch.id)} type="button">
              Stop
            </button>
          </>
        ) : (
          <button className="button button-primary" onClick={() => onRestart(launch.id)} type="button">
            Restart
          </button>
        )}
      </div>
    </aside>
  );
}

export function PolisDashboard({ launch, scenario, templates, onStop, onRestart }) {
  const overview = launch.overview || null;
  const hotChannels = (overview?.channels || []).slice(0, 2);
  const topAgents = (overview?.topAgents || []).slice(0, 2);
  const recentEvents = (overview?.recentEvents || []).slice(0, 3);
  const latestEvent = overview?.latestEvent || null;
  const pulseText = latestEvent
    ? [
        latestEvent.agent || "Someone",
        latestEvent.decisionType || "acted",
        latestEvent.channelLabel ? `in ${latestEvent.channelLabel}` : ""
      ]
        .filter(Boolean)
        .join(" ")
    : "Quiet right now. Launch activity will show up here.";

  const stats = [
    { value: overview?.messageCount ?? "—", label: "messages" },
    {
      value: overview?.activeChannelCount ?? overview?.channelCount ?? scenario?.channelBlueprints?.length ?? "—",
      label: "active channels"
    },
    { value: topAgents[0]?.name || "—", label: "driving", isText: true },
    { value: templateLabel(templates, launch.observerTemplate), label: "view", isText: true }
  ];

  return (
    <div className="polis-detail-panel" key={`${launch.id}-panel`}>
      <div className="polis-detail-main">
        <PolisPulseCard latestEvent={latestEvent} pulseText={pulseText} />

        <div className="polis-detail-grid">
          <PolisMiniList
            emptyText="No channel activity yet."
            items={hotChannels}
            title="Hot Channels"
            renderItem={(channel) => (
              <div className="polis-mini-row" key={channel.id}>
                <div className="polis-mini-main">
                  <span className="polis-mini-title">{channel.label}</span>
                  <span className="polis-mini-subtitle">
                    {channel.topic || `${channel.messageCount} messages`}
                  </span>
                </div>
                <span className="polis-mini-meta">
                  {channel.lastActorName || `${channel.messageCount} msgs`}
                </span>
              </div>
            )}
          />

          <PolisMiniList
            emptyText="No one has taken the lead yet."
            items={topAgents}
            title="Who Is Driving"
            renderItem={(agent) => (
              <div className="polis-mini-row" key={agent.id}>
                <div className="polis-mini-main">
                  <span className="polis-mini-title">{agent.name}</span>
                  <span className="polis-mini-subtitle">{agent.role || "agent"}</span>
                </div>
                <span className="polis-mini-meta">
                  {agent.messageCount}m · {agent.toolCallCount}t
                </span>
              </div>
            )}
          />

          <PolisRecentEvents events={recentEvents} />
        </div>
      </div>

      <PolisActionPanel
        launch={launch}
        onRestart={onRestart}
        onStop={onStop}
        scenario={scenario}
        stats={stats}
        templates={templates}
        topAgents={topAgents}
      />
    </div>
  );
}
