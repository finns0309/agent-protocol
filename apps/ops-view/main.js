import { fetchSessionSnapshot, loadObserverConfig } from "/__observer-client.js";

function createState() {
  const requestedSessionId =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("sessionId") || "" : "";
  return {
    session: null,
    networkApiBase: "http://127.0.0.1:4190",
    sessionId: requestedSessionId
  };
}

function flattenMessages(session) {
  return session.channels.flatMap((channel) =>
    channel.messages.map((message) => ({
      ...message,
      channelId: channel.id,
      channelLabel: channel.label
    }))
  );
}

function latestByType(messages, types) {
  return messages
    .filter((message) => types.includes(String(message.type || "").toLowerCase()))
    .slice(-8)
    .reverse();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderMessageRow(message) {
  return `
    <article class="ops-message-card">
      <div class="ops-message-head">
        <span class="ops-message-type">${escapeHtml(message.type || "chat")}</span>
        <span class="ops-message-channel">${escapeHtml(message.channelLabel)}</span>
        <span class="ops-message-time">${escapeHtml(message.timestamp)}</span>
      </div>
      <div class="ops-message-actor">${escapeHtml(message.actorName)}</div>
      <div class="ops-message-text">${escapeHtml(message.text || "").replaceAll("\n", "<br>")}</div>
    </article>
  `;
}

function render(root, state) {
  if (!state.session) {
    root.innerHTML = `<div class="ops-shell"><div class="ops-empty">Waiting for network-server data...</div></div>`;
    return;
  }

  const messages = flattenMessages(state.session);
  const requests = latestByType(messages, ["request"]);
  const offers = latestByType(messages, ["offer", "route"]);
  const deliveries = latestByType(messages, ["deliver", "confirm"]);

  root.innerHTML = `
    <div class="ops-shell">
      <aside class="ops-sidebar">
        <div class="ops-brand">Ops view</div>
        <div class="ops-workspace">${escapeHtml(state.session.workspace.name)}</div>
        <div class="ops-sidebar-section">
          <div class="ops-label">channels</div>
          ${state.session.channels
            .map(
              (channel) => `
                <div class="ops-channel-row">
                  <span>${channel.prefix === "#" ? "#" : ""}${escapeHtml(channel.label)}</span>
                  <span>${escapeHtml(channel.members)}</span>
                </div>
              `
            )
            .join("")}
        </div>
      </aside>

      <main class="ops-main">
        <section class="ops-panel">
          <div class="ops-panel-title">Active requests</div>
          <div class="ops-list">
            ${requests.length ? requests.map(renderMessageRow).join("") : '<div class="ops-empty-row">No open requests yet</div>'}
          </div>
        </section>

        <section class="ops-panel">
          <div class="ops-panel-title">Offers & routes</div>
          <div class="ops-list">
            ${offers.length ? offers.map(renderMessageRow).join("") : '<div class="ops-empty-row">No offers or routing events yet</div>'}
          </div>
        </section>

        <section class="ops-panel">
          <div class="ops-panel-title">Deliveries</div>
          <div class="ops-list">
            ${deliveries.length ? deliveries.map(renderMessageRow).join("") : '<div class="ops-empty-row">No deliveries yet</div>'}
          </div>
        </section>
      </main>

      <aside class="ops-rail">
        <section class="ops-panel">
          <div class="ops-panel-title">Agents</div>
          <div class="ops-agent-list">
            ${state.session.agents
              .map(
                (agent) => `
                  <div class="ops-agent-row">
                    <span class="ops-agent-dot" style="background:${agent.color}"></span>
                    <div class="ops-agent-main">
                      <div class="ops-agent-name">${escapeHtml(agent.name)}</div>
                      <div class="ops-agent-role">${escapeHtml(agent.role)}</div>
                    </div>
                    <div class="ops-agent-stats">${escapeHtml(agent.stats.messages)}m ${escapeHtml(agent.stats.tools)}t</div>
                  </div>
                `
              )
              .join("")}
          </div>
        </section>

        <section class="ops-panel">
          <div class="ops-panel-title">Recent events</div>
          <div class="ops-events">
            ${state.session.networkEvents
              .slice(0, 12)
              .map(
                (event) => `
                  <div class="ops-event-row">
                    <span class="ops-event-time">${escapeHtml(event.time)}</span>
                    <span class="ops-event-text">${escapeHtml(event.agent)} · ${escapeHtml(event.text)}</span>
                  </div>
                `
              )
              .join("")}
          </div>
        </section>
      </aside>
    </div>
  `;
}

async function mount() {
  const root = document.getElementById("app");
  if (!root) {
    return;
  }

  let state = {
    ...createState(),
    ...(await loadObserverConfig())
  };

  const sync = async () => {
    try {
      const session = await fetchSessionSnapshot(state.networkApiBase, {
        sessionId: state.sessionId
      });
      state = {
        ...state,
        session
      };
    } catch {
      // keep last known state
    }
    render(root, state);
  };

  await sync();
  window.setInterval(sync, 1500);
}

if (typeof document !== "undefined") {
  mount();
}
