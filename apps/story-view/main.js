import { fetchSessionSnapshot, loadObserverConfig, normalizeSessionSnapshot } from "/__observer-client.js";

// ── Cast color palette (parchment-friendly, distinct) ────────────
const CAST_COLORS = [
  "#3d7a4f", // forest green
  "#6b4f2a", // warm brown
  "#4a6fa5", // dusty blue
  "#8c4a6b", // mauve
  "#5a6e3a", // olive
  "#7a503a", // terra cotta
  "#3d5a6b", // slate
  "#7a6230", // golden
];

function castColor(index) {
  return CAST_COLORS[index % CAST_COLORS.length];
}

// ── Utilities ────────────────────────────────────────────────────

function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function silenceLabel(rawTs) {
  if (!rawTs) return "";
  const secs = Math.floor((Date.now() - rawTs) / 1000);
  if (secs < 15)   return "just spoke";
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function sceneRuntime(messages) {
  const timestamps = messages.map((m) => m.rawTimestamp || 0).filter(Boolean);
  if (timestamps.length < 2) return null;
  const secs = Math.floor((Math.max(...timestamps) - Math.min(...timestamps)) / 1000);
  if (secs < 60)   return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

// Detect if text looks like dialogue (starts/ends with quote chars)
function isDialogue(text) {
  return /^["「『「【]/.test(text.trim()) || /^["「』」】]/.test(text.trim());
}

// ── Data helpers ─────────────────────────────────────────────────

function buildTimeline(session) {
  const msgs = [];
  for (const ch of session.channels || []) {
    for (const msg of ch.messages || []) {
      msgs.push({ ...msg, channelLabel: ch.label || ch.name || ch.id });
    }
  }
  return msgs.sort((a, b) => (a.rawTimestamp || 0) - (b.rawTimestamp || 0));
}

function buildLastSeen(messages) {
  const map = new Map();
  for (const m of messages) {
    const id = m.actorId || m.from;
    if (id) map.set(id, m.rawTimestamp || 0);
  }
  return map;
}

function buildAgentColorMap(agents) {
  const map = {};
  agents.forEach((a, i) => { map[a.id] = castColor(i); });
  return map;
}

// Count agents active in last 5 minutes
function countActive(agents, lastSeen) {
  const cutoff = Date.now() - 5 * 60 * 1000;
  return agents.filter((a) => (lastSeen.get(a.id) || 0) > cutoff).length;
}

// ── Render: cast panel ───────────────────────────────────────────

function renderCast(agents, lastSeen, colorMap, now) {
  return agents.map((a) => {
    const ts      = lastSeen.get(a.id) || 0;
    const silent  = ts ? Math.floor((now - ts) / 1000) : null;
    const cls     = silent === null ? "cast-absent"
                  : silent < 30    ? "cast-active"
                  : silent < 120   ? "cast-recent"
                  : silent < 600   ? "cast-quiet"
                  : "cast-absent";
    const when    = silent === null ? "silent"
                  : silent < 10    ? "just spoke"
                  : silenceLabel(ts);
    const color   = colorMap[a.id] || "#c4b49a";
    const initial = (a.displayName || a.name || "?")[0].toUpperCase();
    const isExt   = !!a.connector;

    return `
      <div class="cast-member ${cls}" style="--cast-color:${color}">
        <div class="cast-avatar">${esc(initial)}</div>
        <div class="cast-info">
          <div class="cast-name">
            ${esc(a.displayName || a.name)}${isExt ? ' <span class="cast-ext">ext</span>' : ""}
          </div>
          <div class="cast-role">${esc(a.role || "agent")}</div>
          <div class="cast-when">${esc(when)}</div>
        </div>
      </div>
    `;
  }).join("");
}

// ── Render: narrative messages ───────────────────────────────────
// Groups consecutive messages from the same speaker together.

function renderMessages(messages, colorMap) {
  if (!messages.length) {
    return `<div class="empty-scene">The scene has not yet begun.</div>`;
  }

  // Group consecutive messages by actor
  const groups = [];
  let cur = null;

  for (const msg of messages) {
    const actor = msg.actorId || msg.from || "?";
    const name  = msg.actorName || actor;
    if (cur && cur.actor === actor) {
      cur.lines.push(msg);
    } else {
      cur = { actor, name, lines: [msg], color: colorMap[actor] || "#c4b49a" };
      groups.push(cur);
    }
  }

  return groups.map((group) => {
    const channelLabel = group.lines[0].channelLabel;
    const showChannel  = channelLabel && !["general", "tavern", "main"].includes(channelLabel);

    const linesHtml = group.lines.map((msg) => {
      const text = msg.text || msg.payload?.text || "";
      if (!text.trim()) return "";
      return `
        <div class="msg-line">
          <div class="msg-text${isDialogue(text) ? " is-dialogue" : ""}">${esc(text)}</div>
        </div>
      `;
    }).join("");

    return `
      <div class="msg-group" style="--group-color:${group.color}">
        <div class="msg-speaker">
          <span class="msg-speaker-name">${esc(group.name.toUpperCase())}</span>
          <span class="msg-speaker-rule"></span>
          ${showChannel ? `<span class="msg-channel">${esc(channelLabel)}</span>` : ""}
        </div>
        ${linesHtml}
      </div>
    `;
  }).join("");
}

// ── Main render ──────────────────────────────────────────────────

function render(root, state) {
  if (!state.session) {
    root.innerHTML = `<div class="waiting">// waiting for session…</div>`;
    return;
  }

  const s        = state.session;
  const now      = Date.now();
  const agents   = s.agents || [];
  const timeline = buildTimeline(s);
  const lastSeen = buildLastSeen(timeline);
  const colorMap = buildAgentColorMap(agents);

  const sceneName    = s.workspace?.name || "Scene";
  const sceneAct     = s.workspace?.act  || "ACT I";
  const sceneSetting = (s.channels || []).map((c) => c.topic).filter(Boolean).join(" · ");
  const msgCount     = timeline.length;
  const activeCount  = countActive(agents, lastSeen);
  const runtime      = sceneRuntime(timeline);

  root.innerHTML = `
    <div class="stage">

      <aside class="cast-panel">
        <div class="cast-header">
          <div class="cast-title">Cast</div>
          <div class="cast-subtitle">Characters</div>
        </div>
        <div class="cast-list">
          ${renderCast(agents, lastSeen, colorMap, now)}
        </div>
        <div class="cast-footer">
          <div class="cast-footer-dot"></div>
          <span class="cast-footer-text">${activeCount} active · ${msgCount} lines</span>
        </div>
      </aside>

      <div class="scene-wrap">
        <header class="scene-header">
          <div class="scene-act">${esc(sceneAct)}</div>
          <div class="scene-name">${esc(sceneName)}</div>
          ${sceneSetting ? `<div class="scene-setting">${esc(sceneSetting)}</div>` : ""}
        </header>

        <div class="scene-body" id="scene-body">
          ${renderMessages(timeline, colorMap)}
        </div>

        <footer class="scene-footer">
          <div class="footer-stat">
            <div class="footer-active-dot"></div>
            ${activeCount} agent${activeCount !== 1 ? "s" : ""} active
          </div>
          <span class="footer-sep">·</span>
          <div class="footer-stat">${msgCount} messages</div>
          <span class="footer-sep">·</span>
          <div class="footer-stat">${agents.length} in cast</div>
          <div class="footer-spacer"></div>
          ${runtime ? `<div class="footer-time">scene running ${runtime}</div>` : ""}
        </footer>
      </div>

    </div>
  `;
}

// ── Mount ────────────────────────────────────────────────────────

async function mount() {
  const root = document.getElementById("app");
  if (!root) return;

  let state = {
    session: null,
    networkApiBase: "http://127.0.0.1:4190",
    ...(await loadObserverConfig()),
  };

  let lastMsgCount = 0;

  const sync = async () => {
    try {
      const raw  = await fetchSessionSnapshot(state.networkApiBase);
      const next = normalizeSessionSnapshot ? normalizeSessionSnapshot(raw) : raw;
      if (next) state = { ...state, session: next };
    } catch { /* keep last */ }

    const msgCount = (state.session?.channels || [])
      .reduce((n, ch) => n + (ch.messages?.length || 0), 0);
    const hasNew = msgCount !== lastMsgCount;
    lastMsgCount = msgCount;

    const prevBody      = document.getElementById("scene-body");
    const prevScroll    = prevBody?.scrollTop ?? 0;
    const wasAtBottom   = prevBody
      ? prevBody.scrollTop + prevBody.clientHeight >= prevBody.scrollHeight - 20
      : true;

    render(root, state);

    const body = document.getElementById("scene-body");
    if (body) {
      body.scrollTop = (wasAtBottom || hasNew) ? body.scrollHeight : prevScroll;
    }
  };

  await sync();
  setInterval(sync, 2000);
}

if (typeof document !== "undefined") mount();
