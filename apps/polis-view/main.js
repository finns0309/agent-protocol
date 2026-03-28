import { createChannelPanel, updateChannelPanel } from "./components/channel-panel.js";
import { createNetworkStatusPanel } from "./components/network-status-panel.js";
import { createSidebar } from "./components/sidebar.js";
import { demoSession } from "./data/session.js";
import { fetchSessionSnapshot, loadObserverConfig, normalizeSessionSnapshot } from "/__observer-client.js";

function createState() {
  const requestedSessionId =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("sessionId") || "" : "";
  return {
    session: normalizeSessionSnapshot(demoSession),
    activeChannelId: demoSession.channels[0]?.id || "",
    openMessageId: "",
    networkApiBase: "http://127.0.0.1:4190",
    sessionId: requestedSessionId,
    refreshing: false
  };
}

function getActiveChannel(state) {
  return state.session.channels.find((channel) => channel.id === state.activeChannelId) || state.session.channels[0];
}

function createRail(session, state, setState) {
  const rail = document.createElement("aside");
  rail.className = "rail";
  rail.appendChild(createNetworkStatusPanel(session, state));
  return rail;
}

function captureScrollPositions(nodes) {
  return {
    sidebar: nodes.sidebar?.querySelector(".sb-scroll")?.scrollTop ?? 0,
    feed: nodes.main?.querySelector(".channel-feed")?.scrollTop ?? 0,
    rail: nodes.rail?.querySelector(".rail-scroll")?.scrollTop ?? 0
  };
}

function restoreScrollPositions(nodes, snapshot) {
  window.requestAnimationFrame(() => {
    const sidebar = nodes.sidebar?.querySelector(".sb-scroll");
    const feed = nodes.main?.querySelector(".channel-feed");
    const rail = nodes.rail?.querySelector(".rail-scroll");

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

  const toolbar = document.createElement("div");
  toolbar.className = "observer-toolbar";

  const shell = document.createElement("div");
  shell.className = "observer-shell";
  frame.append(toolbar, shell);
  root.replaceChildren(frame);

  let mounted = false;
  let nodes = {
    frame,
    shell,
    sidebar: null,
    main: null,
    rail: null
  };

  return (state, setState, refresh) => {
    toolbar.innerHTML = `
      <button class="observer-refresh" data-refresh type="button" ${state.refreshing ? "disabled" : ""}>
        ${state.refreshing ? "Refreshing..." : "Refresh"}
      </button>
    `;
    toolbar.querySelector("[data-refresh]")?.addEventListener("click", () => {
      refresh();
    });

    if (!mounted) {
      nodes.sidebar = createSidebar(state.session, state, setState);
      nodes.main = createChannelPanel(getActiveChannel(state), state, setState);
      nodes.rail = createRail(state.session, state, setState);
      shell.append(nodes.sidebar, nodes.main, nodes.rail);
      mounted = true;
      return;
    }

    const snapshot = captureScrollPositions(nodes);
    const nextSidebar = createSidebar(state.session, state, setState);
    const nextRail = createRail(state.session, state, setState);

    nodes.sidebar?.replaceWith(nextSidebar);
    nodes.rail?.replaceWith(nextRail);

    updateChannelPanel(nodes.main, getActiveChannel(state), state, setState);

    nodes = {
      ...nodes,
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

  const render = createRenderer(root);
  let refresh = () => {};

  const setState = (updater) => {
    state = typeof updater === "function" ? updater(state) : updater;
    render(state, setState, refresh);
  };

  render(state, setState, refresh);

  let lastUpdatedAt = state.session.updatedAt || 0;
  const syncSession = async ({ showRefreshing = false } = {}) => {
    if (showRefreshing) {
      setState((current) => ({
        ...current,
        refreshing: true
      }));
    }

    try {
      const nextSession = normalizeSessionSnapshot(
        await fetchSessionSnapshot(state.networkApiBase, {
          sessionId: state.sessionId
        })
      );
      if (!nextSession || !nextSession.channels?.length) {
        setState((current) => ({
          ...current,
          refreshing: false
        }));
        return;
      }

      if ((nextSession.updatedAt || 0) === lastUpdatedAt) {
        setState((current) => ({
          ...current,
          refreshing: false
        }));
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
          activeChannelId: nextActiveChannelId,
          openMessageId: channelStillHasOpenMessage ? current.openMessageId : "",
          refreshing: false
        };
      });
    } catch {
      setState((current) => ({
        ...current,
        refreshing: false
      }));
    }
  };

  refresh = () => {
    syncSession({ showRefreshing: true });
  };

  syncSession();
}

if (typeof document !== "undefined") {
  mount();
}
