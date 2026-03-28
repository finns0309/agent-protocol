export function SwitchDock({ tabs, activeTab, archiveCount, onSelectTab }) {
  return (
    <nav className="cosmos-nav">
      <div className="cosmos-nav-rail">
        {tabs.map((tab) => (
          <button
            className={`nav-tab ${activeTab === tab.id ? "is-active" : ""}`}
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            type="button"
          >
            <span className="nav-tab-icon">{tab.icon}</span>
            <span className="nav-tab-label">{tab.label}</span>
            {tab.id === "history" && archiveCount ? <span className="nav-tab-badge">{archiveCount}</span> : null}
          </button>
        ))}
      </div>
    </nav>
  );
}
