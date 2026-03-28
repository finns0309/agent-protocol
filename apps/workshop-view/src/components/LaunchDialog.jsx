import { Cartridge } from "./Cartridge.jsx";
import { cartridgeDataForScenario } from "../lib/workshop-ui.js";

export function LaunchDialog({ scenario, draft, templates, theme, onChange, onCancel, onConfirm, busy }) {
  const selectedViews = Array.isArray(draft.observerViews) ? draft.observerViews : [];
  const selectedTemplateIds = new Set(selectedViews.map((view) => view.templateId));

  function nextSuggestedPort() {
    const usedPorts = new Set(selectedViews.map((view) => Number(view.port)).filter((value) => Number.isInteger(value) && value > 0));
    let candidate = Number(draft.observerPort || 4285);
    while (usedPorts.has(candidate)) {
      candidate += 1;
    }
    return String(candidate);
  }

  function syncViews(nextViews) {
    onChange(
      "observerViews",
      nextViews.map((view) => ({
        templateId: view.templateId,
        port: String(view.port)
      }))
    );
  }

  function toggleTemplate(templateId) {
    if (selectedTemplateIds.has(templateId)) {
      syncViews(selectedViews.filter((view) => view.templateId !== templateId));
      return;
    }

    syncViews([
      ...selectedViews,
      {
        templateId,
        port: nextSuggestedPort()
      }
    ]);
  }

  function updateViewPort(templateId, port) {
    syncViews(
      selectedViews.map((view) =>
        view.templateId === templateId
          ? {
              ...view,
              port
            }
          : view
      )
    );
  }

  return (
    <div className="overlay-backdrop" onClick={onCancel}>
      <div
        className="launch-dialog launch-dialog-compact"
        onClick={(event) => event.stopPropagation()}
        style={{
          "--launch-accent": theme.color,
          "--launch-accent-soft": `${theme.color}15`
        }}
      >
        <button className="launch-dialog-close" onClick={onCancel} type="button">
          ×
        </button>
        <div className="launch-dialog-header">
          <Cartridge
            data={cartridgeDataForScenario(scenario, theme)}
            size="sm"
            className="is-static"
          />
          <div className="launch-dialog-heading">
            <div className="launch-dialog-kicker">Launch Polis</div>
            <h2 className="launch-dialog-title-compact">{scenario.name}</h2>
            <div className="launch-dialog-subtitle">Turn this Mythos into a living world.</div>
          </div>
        </div>

        <div className="launch-dialog-body">
          <label className="launch-field">
            <span>Polis name</span>
            <input
              type="text"
              value={draft.name}
              onChange={(event) => onChange("name", event.target.value)}
              placeholder={`${scenario.name} sandbox`}
            />
            <small>The name this world will carry while it is running.</small>
          </label>

          <label className="launch-field">
            <span>Views</span>
            <div className="launch-view-picker">
              {templates.map((template) => {
                const active = selectedTemplateIds.has(template.id);
                return (
                  <button
                    className={`launch-view-chip ${active ? "is-active" : ""}`}
                    key={template.id}
                    onClick={() => toggleTemplate(template.id)}
                    type="button"
                  >
                    <span className="launch-view-chip-mark">{active ? "✓" : "+"}</span>
                    <span className="launch-view-chip-copy">
                      <strong>{template.name}</strong>
                      <small>{template.focus || template.description}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <small>Views are read-only lenses on the same Polis.</small>
          </label>

          <details className="launch-advanced">
            <summary>Advanced</summary>
            <div className="launch-dialog-grid launch-dialog-grid-advanced">
              <label className="launch-field">
                <span>Server port</span>
                <input type="number" value={draft.serverPort} onChange={(event) => onChange("serverPort", event.target.value)} />
                <small>Where this Polis will run.</small>
              </label>
            </div>

            {selectedViews.length ? (
              <div className="launch-view-ports">
                {selectedViews.map((view) => {
                  const template = templates.find((entry) => entry.id === view.templateId);
                  return (
                    <label className="launch-field" key={view.templateId}>
                      <span>{template?.name || view.templateId} port</span>
                      <input
                        type="number"
                        value={view.port}
                        onChange={(event) => updateViewPort(view.templateId, event.target.value)}
                      />
                      <small>{template?.description || "Observation lens"}</small>
                    </label>
                  );
                })}
              </div>
            ) : null}

            {!selectedViews.length ? (
              <div className="launch-empty-note">Choose at least one lens before this Polis can be observed.</div>
            ) : null}
          </details>
        </div>

        <div className="launch-dialog-actions">
          <button className="button button-secondary" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="button button-primary" disabled={busy || !selectedViews.length} onClick={onConfirm} type="button">
            {busy ? "Launching..." : "Launch Polis"}
          </button>
        </div>
      </div>
    </div>
  );
}
