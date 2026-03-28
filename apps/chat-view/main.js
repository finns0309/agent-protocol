import { createChannelPanel, updateChannelPanel } from "./components/channel-panel.js";
import { createNetworkStatusPanel } from "./components/network-status-panel.js";
import { createSessionSwitcher } from "./components/session-switcher.js";
import { createSidebar } from "./components/sidebar.js";
import { demoSession } from "./data/session.js";
import {
  fetchSessionList,
  fetchSessionSnapshot,
  loadObserverConfig,
  normalizeSessionSnapshot
} from "/__observer-client.js";

function createState() {
  const requestedSessionId =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("sessionId") || "" : "";
  return {
    session: normalizeSessionSnapshot(demoSession),
    activeChannelId: demoSession.channels[0]?.id || "",
    openMessageId: "",
    expandedMessageIds: [],
    sessions: [],
    networkApiBase: "http://127.0.0.1:4190",
    sessionId: requestedSessionId,
    resolvedSessionId: requestedSessionId
  };
}

function getActiveChannel(state) {
  return state.session.channels.find((channel) => channel.id === state.activeChannelId) || state.session.channels[0];
}

function buildSessionListSignature(sessions = []) {
  return sessions
    .map((session) =>
      [
        session.id || "",
        session.name || "",
        session.scenarioId || "",
        session.updatedAt || 0,
        session.stats?.messages || 0
      ].join(":")
    )
    .join("|");
}

function syncBrowserSessionQuery(sessionId) {
  if (typeof window === "undefined" || !window.history?.replaceState) {
    return;
  }

  const url = new URL(window.location.href);
  if (sessionId) {
    url.searchParams.set("sessionId", sessionId);
  } else {
    url.searchParams.delete("sessionId");
  }
  window.history.replaceState({}, "", url);
}

function createRail(session, state, setState) {
  const rail = document.createElement("aside");
  rail.className = "rail";
  rail.appendChild(createNetworkStatusPanel(session, state));
  return rail;
}

function captureScrollPositions(nodes) {
  return {
    sessions: nodes.sessions?.querySelector(".session-rail-scroll")?.scrollTop ?? 0,
    sidebar: nodes.sidebar?.querySelector(".sb-scroll")?.scrollTop ?? 0,
    feed: nodes.main?.querySelector(".channel-feed")?.scrollTop ?? 0,
    rail: nodes.rail?.querySelector(".rail-scroll")?.scrollTop ?? 0
  };
}

function restoreScrollPositions(nodes, snapshot) {
  window.requestAnimationFrame(() => {
    const sessions = nodes.sessions?.querySelector(".session-rail-scroll");
    const sidebar = nodes.sidebar?.querySelector(".sb-scroll");
    const feed = nodes.main?.querySelector(".channel-feed");
    const rail = nodes.rail?.querySelector(".rail-scroll");

    if (sessions) {
      sessions.scrollTop = snapshot.sessions;
    }
    if (sidebar) {
      sidebar.scrollTop = snapshot.sidebar;
    }
    if (feed) {
      feed.scrollTop = snapshot.feed;
    }
    if (rail) {
      rail.scrollTop = snapshot.rail;
    }
  });
}

function createRenderer(root) {
  const frame = document.createElement("div");
  frame.className = "observer-frame";

  const shell = document.createElement("div");
  shell.className = "observer-shell";
  frame.appendChild(shell);
  root.replaceChildren(frame);

  let mounted = false;
  let nodes = {
    frame,
    shell,
    sessions: null,
    sidebar: null,
    main: null,
    rail: null
  };

  return (state, setState) => {
    if (!mounted) {
      nodes.sessions = createSessionSwitcher(state, setState);
      nodes.sidebar = createSidebar(state.session, state, setState);
      nodes.main = createChannelPanel(getActiveChannel(state), state, setState);
      nodes.rail = createRail(state.session, state, setState);
      shell.append(nodes.sessions, nodes.sidebar, nodes.main, nodes.rail);
      mounted = true;
      return;
    }

    const snapshot = captureScrollPositions(nodes);
    const nextSessions = createSessionSwitcher(state, setState);
    const nextSidebar = createSidebar(state.session, state, setState);
    const nextRail = createRail(state.session, state, setState);

    nodes.sessions?.replaceWith(nextSessions);
    nodes.sidebar?.replaceWith(nextSidebar);
    nodes.rail?.replaceWith(nextRail);

    updateChannelPanel(nodes.main, getActiveChannel(state), state, setState);

    nodes = {
      ...nodes,
      sessions: nextSessions,
      sidebar: nextSidebar,
      rail: nextRail
    };

    restoreScrollPositions(nodes, snapshot);
  };
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

  try {
    const sessions = await fetchSessionList(state.networkApiBase);
    if (sessions.length) {
      state = {
        ...state,
        sessions,
        sessionId: state.sessionId || sessions[0].id || "",
        resolvedSessionId: state.resolvedSessionId || state.sessionId || sessions[0].id || ""
      };
    }
  } catch {
    // Keep the shell usable even when session discovery is unavailable.
  }

  const render = createRenderer(root);
  let syncSession = async () => {};

  const setState = (updater) => {
    const previousSessionId = state.sessionId;
    const nextState = typeof updater === "function" ? updater(state) : updater;
    if (nextState.sessionId !== state.sessionId) {
      syncBrowserSessionQuery(nextState.sessionId);
    }
    state = nextState;
    render(state, setState);
    if (nextState.sessionId !== previousSessionId) {
      syncSession().catch(() => {
        // Keep current UI when an explicit session switch fetch fails.
      });
    }
  };

  render(state, setState);

  let lastUpdatedAt = state.session.updatedAt || 0;
  let lastSessionListSignature = buildSessionListSignature(state.sessions);
  syncSession = async () => {
    try {
      const [nextSessionRaw, nextSessionListRaw] = await Promise.all([
        fetchSessionSnapshot(state.networkApiBase, {
          sessionId: state.sessionId
        }),
        fetchSessionList(state.networkApiBase).catch(() => state.sessions)
      ]);
      const nextSession = normalizeSessionSnapshot(nextSessionRaw);
      const nextSessions = Array.isArray(nextSessionListRaw) ? nextSessionListRaw : [];
      const nextSessionListSignature = buildSessionListSignature(nextSessions);
      const sessionListChanged = nextSessionListSignature !== lastSessionListSignature;

      if (sessionListChanged) {
        lastSessionListSignature = nextSessionListSignature;
      }

      if (!nextSession || !nextSession.channels?.length) {
        if (sessionListChanged) {
          setState((current) => ({
            ...current,
            sessions: nextSessions
          }));
        }
        return;
      }

      const nextResolvedSessionId = nextSession.session?.id || state.resolvedSessionId || state.sessionId || "";
      const sessionChanged = nextResolvedSessionId !== state.resolvedSessionId;
      if ((nextSession.updatedAt || 0) === lastUpdatedAt && !sessionListChanged && !sessionChanged) {
        return;
      }

      lastUpdatedAt = nextSession.updatedAt || Date.now();
      setState((current) => {
        const nextActiveChannelId = nextSession.channels.some((channel) => channel.id === current.activeChannelId)
          ? current.activeChannelId
          : nextSession.channels[0]?.id || "";

        const channelStillHasOpenMessage = nextSession.channels
          .flatMap((channel) => channel.messages)
          .some((message) => message.id === current.openMessageId);

        return {
          ...current,
          session: nextSession,
          sessions: nextSessions.length ? nextSessions : current.sessions,
          sessionId: current.sessionId || nextResolvedSessionId,
          resolvedSessionId: nextResolvedSessionId,
          activeChannelId: nextActiveChannelId,
          openMessageId: channelStillHasOpenMessage ? current.openMessageId : "",
          expandedMessageIds: current.expandedMessageIds.filter((messageId) =>
            nextSession.channels.flatMap((channel) => channel.messages).some((message) => message.id === messageId)
          )
        };
      });
    } catch {
      // Keep current data when network api is unavailable.
    }
  };

  syncSession();
  window.setInterval(syncSession, 1200);
}

if (typeof document !== "undefined") {
  mount();
}
