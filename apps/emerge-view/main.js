import { fetchSessionSnapshot, loadObserverConfig } from "/__observer-client.js";

// Message type config — colors tuned for warm light background
const TYPE_CFG = {
  deliver:   { color: "#7c3aed", score: 7, label: "DELIVER" },
  confirm:   { color: "#059669", score: 6, label: "CONFIRM" },
  negotiate: { color: "#be185d", score: 5, label: "NEGOTIATE" },
  offer:     { color: "#1d4ed8", score: 4, label: "OFFER" },
  route:     { color: "#b45309", score: 3, label: "ROUTE" },
  request:   { color: "#0369a1", score: 2, label: "REQUEST" },
  announce:  { color: "#b0a898", score: 1, label: "ANNOUNCE" },
};

function typeColor(t) { return TYPE_CFG[t?.toLowerCase()]?.color ?? "#4b5563"; }
function typeScore(t) { return TYPE_CFG[t?.toLowerCase()]?.score ?? 0; }

// Build edges from session: explicit mentions + channel co-presence
function buildGraph(session) {
  const agents = session.agents || [];
  const edgeMap = new Map();

  function addEdge(fromId, toId, type, strong) {
    if (!fromId || !toId || fromId === toId) return;
    const key = [fromId, toId].sort().join("|");
    const score = typeScore(type);
    const e = edgeMap.get(key);
    if (!e) {
      edgeMap.set(key, { from: fromId, to: toId, count: 1, bestType: type, bestScore: score, strong });
    } else {
      e.count++;
      if (score > e.bestScore) { e.bestType = type; e.bestScore = score; }
      if (strong) e.strong = true;
    }
  }

  for (const channel of session.channels || []) {
    const senders = [...new Set((channel.messages || []).map(m => m.actorId).filter(Boolean))];

    for (const msg of channel.messages || []) {
      if (!msg.actorId) continue;
      const type = (msg.type || "announce").toLowerCase();
      for (const mid of msg.mentionedIds || []) {
        addEdge(msg.actorId, mid, type, true);
      }
    }

    // Co-presence: faint background edge if no explicit mention edge yet
    for (let i = 0; i < senders.length; i++) {
      for (let j = i + 1; j < senders.length; j++) {
        const key = [senders[i], senders[j]].sort().join("|");
        if (!edgeMap.has(key)) {
          edgeMap.set(key, { from: senders[i], to: senders[j], count: 1, bestType: "announce", bestScore: 0, strong: false });
        }
      }
    }
  }

  return { agents, edges: [...edgeMap.values()] };
}

// Place agents evenly on a circle, starting from top
function circleLayout(agents, cx, cy, r) {
  const n = agents.length;
  return agents.map((a, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { ...a, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
}

function renderGraph(container, session) {
  const { agents, edges } = buildGraph(session);
  if (!agents.length) { container.innerHTML = ""; return; }

  const W = container.clientWidth || 600;
  const H = container.clientHeight || 500;
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) * 0.33;
  const nodeR = 26;

  const placed = circleLayout(agents, cx, cy, r);
  const posMap = new Map(placed.map(a => [a.id, a]));

  // SVG edges
  const edgeSvg = edges.map(e => {
    const A = posMap.get(e.from);
    const B = posMap.get(e.to);
    if (!A || !B) return "";
    const color = e.strong ? typeColor(e.bestType) : "#ece5da";
    const sw = e.strong ? Math.min(3, 1 + e.count * 0.4) : 1;
    const mx = (A.x + B.x) / 2;
    const my = (A.y + B.y) / 2;
    const dx = cx - mx;
    const dy = cy - my;
    const qx = mx + dx * 0.2;
    const qy = my + dy * 0.2;
    return `<path d="M${A.x} ${A.y} Q${qx} ${qy} ${B.x} ${B.y}" fill="none"
      stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }).join("");

  // SVG nodes — neobrutalist: flat fill, hard black border, monospace text
  const nodeSvg = placed.map(a => {
    const initials = a.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const isExternal = !!(a.connector?.connectorType ?? a.connector);
    const rep = a.social?.reputationScore || 0;
    const trustState = a.social?.onboarding?.trustState || "";
    const firstName = a.name.split(" ")[0].toUpperCase();
    // Trust indicator color
    const trustFill = trustState === "trusted" ? "#d4f5e0"
      : trustState === "tentatively_trusted" ? "#ffd43b"
      : "none";
    return `
      <g transform="translate(${a.x.toFixed(1)},${a.y.toFixed(1)})">
        <circle r="${nodeR}" fill="${a.color}" stroke="#111111" stroke-width="2.5"
          stroke-dasharray="${isExternal ? "5 3" : "none"}"/>
        <text text-anchor="middle" dy="5" font-size="13" font-weight="900" fill="#111111"
          font-family="'Courier New',monospace">${initials}</text>
        <text text-anchor="middle" dy="${nodeR + 16}" font-size="11" font-weight="900" fill="#111111"
          font-family="'Courier New',monospace">${firstName}</text>
        <text text-anchor="middle" dy="${nodeR + 28}" font-size="9" fill="#8f8a82"
          font-family="'Courier New',monospace">${a.role.toUpperCase()}</text>
        ${rep > 0 ? `
          <rect x="${nodeR - 2}" y="${-nodeR - 10}" width="22" height="14" fill="#ffd43b" stroke="#111" stroke-width="1.5"/>
          <text x="${nodeR + 9}" y="${-nodeR - 1}" text-anchor="middle" font-size="9" font-weight="900"
            fill="#111" font-family="'Courier New',monospace">★${rep}</text>` : ""}
        ${trustFill !== "none" ? `
          <circle cx="${-nodeR + 5}" cy="${-nodeR + 5}" r="5" fill="${trustFill}" stroke="#111" stroke-width="1.5"/>` : ""}
      </g>`;
  }).join("");

  container.innerHTML = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <rect width="${W}" height="${H}" fill="#fffef5"/>
      ${edgeSvg}
      ${nodeSvg}
    </svg>`;
}

function escHtml(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderAgentVitals(agents) {
  return agents.map(a => {
    const social = a.social || {};
    const trust = social.onboarding?.trustState || "";
    const trustLabel = { trusted: "trusted", tentatively_trusted: "tentative", unknown: "unknown" }[trust] || "";
    const initials = (a.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    return `
      <div class="vital-card${a.active ? " vital-active" : ""}">
        <div class="vital-header">
          <span class="vital-avatar" style="background:${a.color};color:#111">${initials}</span>
          <div class="vital-meta">
            <div class="vital-name">${escHtml(a.name)}</div>
            <div class="vital-role">${escHtml(a.role)}</div>
          </div>
        </div>
        <div class="vital-stats">
          <span><b>${a.stats?.messages ?? 0}</b> msg</span>
          <span><b>${a.stats?.tools ?? 0}</b> tools</span>
          <span><b>${social.reputationScore ?? 0}</b> rep</span>
        </div>
        ${trustLabel ? `<div class="vital-trust trust-${trust}">${trustLabel}</div>` : ""}
        ${a.connector ? `<div class="vital-connector">${escHtml(a.connector.connectorType || a.connector)}</div>` : ""}
      </div>`;
  }).join("");
}

function renderEvents(events) {
  if (!events?.length) return `<div class="no-events">No events yet</div>`;
  return events.slice(0, 30).map(e => `
    <div class="event-row">
      <span class="ev-time">${escHtml(e.time)}</span>
      <span class="ev-dot" style="background:${escHtml(e.color || "#4b5563")}"></span>
      <div class="ev-body">
        <span class="ev-agent">${escHtml(e.agent)}</span>
        <span class="ev-text">${escHtml(e.text.split("\n")[0].replace(/\*\*/g, ""))}</span>
        ${e.badge ? `<span class="ev-badge">${escHtml(e.badge)}</span>` : ""}
      </div>
    </div>`).join("");
}

function renderLegend() {
  return Object.entries(TYPE_CFG)
    .filter(([t]) => t !== "announce")
    .map(([, cfg]) => `
      <span class="leg-item">
        <span class="leg-dot" style="background:${cfg.color}"></span>
        <span class="leg-label">${cfg.label}</span>
      </span>`).join("");
}

function render(root, state) {
  if (!state.session) {
    root.innerHTML = `<div class="shell"><div class="empty">Waiting for network-server...</div></div>`;
    return;
  }

  const s = state.session;
  const totalMsg = (s.channels || []).reduce((n, ch) => n + (ch.messages?.length || 0), 0);

  root.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="tb-left">
          <span class="brand">emerge</span>
          <span class="ws-name">${escHtml(s.workspace?.name || "")}</span>
        </div>
        <div class="tb-stats">
          <span class="ts"><b>${s.agents?.length || 0}</b> agents</span>
          <span class="ts"><b>${s.channels?.length || 0}</b> channels</span>
          <span class="ts"><b>${totalMsg}</b> messages</span>
        </div>
        <div class="legend">${renderLegend()}</div>
      </header>

      <div class="body">
        <div class="graph-wrap" id="graph-wrap"></div>
        <aside class="events-rail">
          <div class="rail-title">Network events</div>
          <div class="events-scroll">
            ${renderEvents(s.networkEvents)}
          </div>
        </aside>
      </div>

      <div class="vitals-bar">
        ${renderAgentVitals(s.agents || [])}
      </div>
    </div>`;

  const wrap = document.getElementById("graph-wrap");
  if (wrap) renderGraph(wrap, s);
}

async function mount() {
  const root = document.getElementById("app");
  if (!root) return;

  let state = { session: null, networkApiBase: "http://127.0.0.1:4190", ...(await loadObserverConfig()) };

  const sync = async () => {
    try {
      state = { ...state, session: await fetchSessionSnapshot(state.networkApiBase) };
    } catch { /* keep last */ }
    render(root, state);
  };

  await sync();
  setInterval(sync, 2000);
}

if (typeof document !== "undefined") mount();
