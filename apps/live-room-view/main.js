import { fetchSessionSnapshot, loadObserverConfig, normalizeSessionSnapshot } from "/__observer-client.js";

// ── Palette ──────────────────────────────────────────────────────
const PALETTE = [
  "#10B981", "#06B6D4", "#F59E0B", "#8B5CF6",
  "#EF4444", "#EC4899", "#F97316", "#3B82F6",
];

function agentColor(index) {
  return PALETTE[index % PALETTE.length];
}

// ── Grid column logic (Zoom-style) ───────────────────────────────
//  1 → 1 col   (full)
//  2 → 2 cols  (50/50)
//  3-4 → 2 cols
//  5-9 → 3 cols
//  10+ → 4 cols
function gridCols(count) {
  if (count <= 1) return 1;
  if (count <= 2) return 2;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

// Avatar size scales down as more tiles appear
function avatarSize(cols) {
  if (cols === 1) return 96;
  if (cols === 2) return 72;
  if (cols === 3) return 56;
  return 44;
}

// ── Pixel avatar SVG ─────────────────────────────────────────────
function pixelAvatar(color, size) {
  const p = size / 8;
  const bg = color + "18";
  const pixels = [
    [2,1],[3,1],[4,1],[5,1],
    [1,2],[6,2],
    [2,3],[5,3],
    [1,4],[6,4],
    [2,5],[5,5],
    [3,6],[4,6],
    [1,6],[6,6],
    [2,7],[3,7],[4,7],[5,7],
  ];
  const rects = pixels
    .map(([c, r]) => `<rect x="${c*p}" y="${r*p}" width="${p}" height="${p}" fill="${color}"/>`)
    .join("");
  return (
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="${bg}"/>` +
    rects + `</svg>`
  );
}

function avatarImg(color, size) {
  const uri = `data:image/svg+xml,${encodeURIComponent(pixelAvatar(color, size))}`;
  return `<img src="${uri}" width="${size}" height="${size}" style="display:block;image-rendering:pixelated;flex-shrink:0" alt=""/>`;
}

// ── Utilities ────────────────────────────────────────────────────
function escapeHtml(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function excerpt(v, limit = 220) {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s.length > limit ? `${s.slice(0, limit - 1)}…` : s;
}

function formatRelativeTime(ts) {
  if (!ts) return "now";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 15)   return "now";
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// Lightweight markdown → safe HTML
function renderMarkdown(raw, inline = false) {
  let s = escapeHtml(String(raw ?? ""));
  s = s.replace(/^#{1,6}\s+(.+)$/gm, '<span style="font-family:var(--px);font-size:6px;display:block;line-height:2.2;color:var(--muted)">$1</span>');
  s = s.replace(/^-{3,}$/gm, '<span style="display:block;border-top:2px solid var(--line);margin:4px 0"></span>');
  s = s.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/^\|[\s\-|:]+\|$/gm, "");
  s = s.replace(/\|/g, " │ ");
  if (!inline) s = s.replace(/\n/g, "<br>");
  return s;
}

// ── State ────────────────────────────────────────────────────────
function createState() {
  const sessionId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("sessionId") || ""
      : "";
  return { session: null, sessionId, networkApiBase: "http://127.0.0.1:4190" };
}

function flattenMessages(session) {
  return (session?.channels || [])
    .flatMap((ch) =>
      (ch.messages || []).map((msg) => ({
        ...msg,
        channelId: ch.id,
        channelLabel: ch.label || ch.name || ch.id,
      }))
    )
    .sort((a, b) => (a.rawTimestamp || 0) - (b.rawTimestamp || 0));
}

function findHostAgent(session) {
  const agents = Array.isArray(session?.agents) ? session.agents : [];
  return (
    agents.find((a) => /host|mc|presenter/i.test(`${a.role || ""} ${a.id || ""}`)) ||
    agents[0] ||
    null
  );
}

function buildAgentMap(agents) {
  const map = {};
  agents.forEach((a, i) => { map[a.id] = { ...a, colorIndex: i }; });
  return map;
}

// ── Tile render ──────────────────────────────────────────────────
function renderTile(agent, agentIndex, isSpeaking, isHost, lastMessage, avSize) {
  const color  = agentColor(agentIndex);
  const name   = agent?.displayName || agent?.name || "Agent";
  const role   = agent?.role || (isHost ? "host" : "agent");
  const text   = lastMessage?.text ? excerpt(lastMessage.text, 160) : (agent?.directive || "");

  return `
    <div class="agent-tile ${isSpeaking ? "is-speaking" : ""}" style="--agent-color:${color}">
      ${isSpeaking ? '<div class="tile-bar"></div>' : ""}
      ${avatarImg(color, avSize)}
      <div class="tile-name">${escapeHtml(name)}</div>
      <div class="tile-badges">
        ${isHost ? `<span class="tile-badge is-host">[HOST]</span>` : ""}
        <span class="tile-badge" style="color:${color};border-color:${color}">[${escapeHtml(excerpt(role, 24))}]</span>
      </div>
      ${isSpeaking ? `<div class="pixel-wave"><span></span><span></span><span></span><span></span><span></span><span></span></div>` : ""}
      ${text
        ? `<div class="tile-text">${renderMarkdown(text, true)}</div>`
        : `<div class="tile-idle">// idle</div>`
      }
    </div>
  `;
}

// ── Chat messages ────────────────────────────────────────────────
function renderMessages(messages, agentMap) {
  if (!messages.length) {
    return `<div class="chat-empty">// room is quiet</div>`;
  }
  return messages.map((msg) => {
    const id    = msg.actorId || msg.from;
    const info  = agentMap[id];
    const color = info ? agentColor(info.colorIndex) : "#9a9aa5";
    const name  = msg.actorName || id || "unknown";
    const time  = msg.timestamp || formatRelativeTime(msg.rawTimestamp || 0);
    return `
      <div class="chat-msg">
        <div class="chat-msg-meta">
          <span class="chat-msg-author" style="color:${color}">${escapeHtml(name)}</span>
          <span class="chat-msg-time">${escapeHtml(time)}</span>
        </div>
        <div class="chat-msg-text">${renderMarkdown(excerpt(msg.text || "", 220), true)}</div>
      </div>
    `;
  }).join("");
}

// ── Main render ──────────────────────────────────────────────────
function render(root, state) {
  if (!state.session) {
    root.innerHTML = `<div class="room-empty"><span class="room-empty-label">// waiting for session…</span></div>`;
    return;
  }

  const session   = state.session;
  const allAgents = Array.isArray(session.agents) ? session.agents : [];
  const agentMap  = buildAgentMap(allAgents);
  const messages  = flattenMessages(session);
  const host      = findHostAgent(session);

  // Who is currently speaking = author of most recent message
  const latestMsg  = messages[messages.length - 1] || null;
  const speakerId  = latestMsg?.actorId || latestMsg?.from || host?.id;
  const speakerIdx = allAgents.findIndex((a) => a.id === speakerId);

  // Last message per agent (for tile text)
  const lastMsgByAgent = {};
  messages.forEach((msg) => {
    const id = msg.actorId || msg.from;
    if (id) lastMsgByAgent[id] = msg;
  });

  // Ordering: speaker first, then host (if different), then rest
  const speakerAgent = speakerIdx >= 0 ? allAgents[speakerIdx] : (host || allAgents[0]);
  const ordered = [
    ...(speakerAgent ? [speakerAgent] : []),
    ...(host && host.id !== speakerAgent?.id ? [host] : []),
    ...allAgents.filter((a) => a.id !== speakerAgent?.id && a.id !== host?.id),
  ];

  const cols   = gridCols(allAgents.length);
  const avSize = avatarSize(cols);

  // Chat: chronological, last 20
  const feed = messages.slice(-20);

  // Scroll position guard
  const chatEl     = root.querySelector("#chat-scroll");
  const wasAtBottom = !chatEl || chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < 80;

  const roomName    = session.workspace?.name || "live_room";
  const channels    = Array.isArray(session.channels) ? session.channels : [];
  const channelLabel = channels[0]?.label || channels[0]?.name || "main";

  root.innerHTML = `
    <div class="room-shell">
      <header class="room-topbar">
        <span class="topbar-logo">&gt;_</span>
        <span class="topbar-title">${escapeHtml(roomName)}</span>
        <div class="topbar-live">
          <div class="topbar-live-dot"></div>
          <span class="topbar-live-label">LIVE</span>
        </div>
        <div class="topbar-spacer"></div>
        <span class="topbar-meta">
          ${escapeHtml(channelLabel)} &nbsp;//&nbsp; ${allAgents.length} agents &nbsp;//&nbsp; ${messages.length} msgs
        </span>
      </header>

      <div class="room-body">
        <div class="room-stage">
          <div class="agents-grid" style="--cols:${cols}">
            ${ordered.map((agent) => {
              const idx       = allAgents.findIndex((a) => a.id === agent.id);
              const speaking  = agent.id === speakerAgent?.id;
              const isHostTile = agent.id === host?.id;
              return renderTile(agent, idx, speaking, isHostTile, lastMsgByAgent[agent.id], avSize);
            }).join("")}
          </div>
        </div>

        <div class="room-chat">
          <div class="chat-header">
            <span class="chat-header-label">// message_log</span>
            <span class="chat-header-live">[live]</span>
          </div>
          <div class="chat-messages" id="chat-scroll">
            ${renderMessages(feed, agentMap)}
          </div>
          <div class="chat-footer">
            <div class="chat-footer-dot"></div>
            <span class="chat-footer-label">// read_only &nbsp; no_input</span>
          </div>
        </div>
      </div>
    </div>
  `;

  if (wasAtBottom) {
    const el = root.querySelector("#chat-scroll");
    if (el) el.scrollTop = el.scrollHeight;
  }
}

// ── Mount ────────────────────────────────────────────────────────
async function mount() {
  const root = document.getElementById("app");
  if (!root) return;

  let state = { ...createState(), ...(await loadObserverConfig()) };
  const setState = (updater) => {
    state = typeof updater === "function" ? updater(state) : updater;
    render(root, state);
  };

  let lastUpdatedAt = 0;
  const sync = async () => {
    try {
      const next = normalizeSessionSnapshot(
        await fetchSessionSnapshot(state.networkApiBase, { sessionId: state.sessionId })
      );
      if (!next) return;
      if ((next.updatedAt || 0) === lastUpdatedAt && state.session) return;
      lastUpdatedAt = next.updatedAt || Date.now();
      setState((s) => ({ ...s, session: next }));
    } catch { /* silently retry */ }
  };

  await sync();
  window.setInterval(sync, 1500);
}

if (typeof document !== "undefined") mount();
