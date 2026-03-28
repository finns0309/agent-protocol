import { createMessageItem, createReactionItem } from "./message-item.js";

function systemMessage(systemText) {
  const wrapper = document.createElement("div");
  wrapper.className = "sys-msg";
  wrapper.innerHTML = `
    <div class="sys-line"></div>
    <span class="sys-text">${systemText}</span>
    <div class="sys-line"></div>
  `;
  return wrapper;
}

export function createMessageList(channel, state, setState) {
  const feed = document.createElement("div");
  feed.className = "channel-feed";

  if (channel.systemMessage) {
    feed.appendChild(systemMessage(channel.systemMessage));
  }

  renderTimeline(feed, channel, state, setState, systemNodePresent(feed));

  return feed;
}

function systemNodePresent(feed) {
  return feed.querySelector(".sys-msg");
}

function syncTraceState(node, open) {
  const trace = node.querySelector(".message-trace");
  if (!trace) {
    return;
  }

  if (open) {
    trace.classList.add("is-open");
  } else {
    trace.classList.remove("is-open");
  }
}

function attachMessageToggle(node, messageId, setState) {
  node.addEventListener("click", () => {
    setState((current) => ({
      ...current,
      openMessageId: current.openMessageId === messageId ? "" : messageId
    }));
  });
}

export function updateMessageList(feed, channel, state, setState) {
  let systemNode = feed.querySelector(".sys-msg");
  if (channel.systemMessage) {
    if (!systemNode) {
      systemNode = systemMessage(channel.systemMessage);
      feed.prepend(systemNode);
    } else {
      const text = systemNode.querySelector(".sys-text");
      if (text) {
        text.textContent = channel.systemMessage;
      }
    }
  } else if (systemNode) {
    systemNode.remove();
    systemNode = null;
  }

  for (const node of Array.from(feed.children)) {
    if (!node.classList.contains("sys-msg")) {
      node.remove();
    }
  }
  renderTimeline(feed, channel, state, setState, systemNode);
}

function renderTimeline(feed, channel, state, setState, systemNode = null) {
  const anchor = systemNode ? systemNode.nextSibling : null;
  let cursor = anchor;
  const timeline = Array.isArray(channel.timeline)
    ? channel.timeline
    : channel.messages.map((message) => ({ kind: "message", id: message.id, message }));

  for (const item of timeline) {
    let node = null;
    if (item.kind === "reaction") {
      node = createReactionItem(item.reaction);
    } else {
      const message = item.message;
      node = createMessageItem(message, {
        open: state.openMessageId === message.id,
        expanded: true
      });
      attachMessageToggle(node, message.id, setState);
      syncTraceState(node, state.openMessageId === message.id);
    }
    if (cursor) {
      feed.insertBefore(node, cursor);
    } else {
      feed.appendChild(node);
    }
    cursor = node.nextSibling;
  }
}
