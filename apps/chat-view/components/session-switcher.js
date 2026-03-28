function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function deriveSessionGlyph(session, index) {
  const idMatch = String(session?.id || "").match(/(\d+)$/);
  if (idMatch) {
    return `S${idMatch[1]}`;
  }

  const words = String(session?.name || session?.workspaceName || `S${index + 1}`)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2);
  const initials = words.map((word) => word[0]?.toUpperCase() || "").join("");
  return initials || `S${index + 1}`;
}

function buildSessionTitle(session) {
  const name = String(session?.name || session?.workspaceName || session?.id || "Session");
  const scenario = String(session?.scenarioName || "").trim();
  return scenario ? `${name} · ${scenario}` : name;
}

function createSessionButton(session, index, isActive, onSelect) {
  const button = document.createElement("button");
  button.className = `session-pill ${isActive ? "is-active" : ""}`;
  button.type = "button";
  button.dataset.sessionId = session.id;
  button.title = buildSessionTitle(session);
  button.setAttribute("aria-label", buildSessionTitle(session));
  button.innerHTML = `<span class="session-pill-label">${escapeHtml(deriveSessionGlyph(session, index))}</span>`;
  button.addEventListener("click", onSelect);
  return button;
}

export function createSessionSwitcher(state, setState) {
  const aside = document.createElement("aside");
  aside.className = "session-rail";

  const resolvedSessionId = state.resolvedSessionId || state.sessionId || state.session?.session?.id || "";
  const sessions =
    Array.isArray(state.sessions) && state.sessions.length
      ? state.sessions
      : [
          {
            id: resolvedSessionId || "session-current",
            name: state.session?.session?.name || state.session?.workspace?.name || "Current session",
            workspaceName: state.session?.workspace?.name || "Polis"
          }
        ];

  aside.innerHTML = `
    <div class="session-rail-head">
      <div class="session-home" aria-hidden="true">P</div>
    </div>
    <div class="session-rail-scroll">
      <div class="session-rail-list"></div>
    </div>
  `;

  const list = aside.querySelector(".session-rail-list");
  sessions.forEach((session, index) => {
    list.appendChild(
      createSessionButton(session, index, session.id === resolvedSessionId, () => {
        if (!session.id || session.id === resolvedSessionId) {
          return;
        }

        setState((current) => ({
          ...current,
          sessionId: session.id,
          resolvedSessionId: session.id,
          openMessageId: "",
          expandedMessageIds: []
        }));
      })
    );
  });

  return aside;
}
