export function ConsoleTopBar({ liveCount, refreshing = false, onRefresh, clockText }) {
  return (
    <header className="cosmos-topbar">
      <div className="topbar-brand">
        <span className="brand-mark">Cosmos</span>
      </div>
      <div className="topbar-actions">
        <button className="topbar-refresh" disabled={refreshing} onClick={onRefresh} type="button">
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
        <span className="topbar-pill">{liveCount} live</span>
        <span className="topbar-clock">{clockText}</span>
      </div>
    </header>
  );
}
