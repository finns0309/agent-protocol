import { createMessageItem } from "./message-item.js";

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

  for (const message of channel.messages) {
    const item = createMessageItem(message, {
      open: state.openMessageId === message.id
    });

    item.addEventListener("click", () => {
      setState((current) => ({
        ...current,
        openMessageId: current.openMessageId === message.id ? "" : message.id
      }));
    });
    feed.appendChild(item);
  }

  return feed;
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

  const existing = new Map();
  for (const node of feed.querySelectorAll(".message[data-message-id]")) {
    existing.set(node.dataset.messageId, node);
  }

  const validIds = new Set(channel.messages.map((message) => message.id));
  for (const [messageId, node] of existing.entries()) {
    if (!validIds.has(messageId)) {
      node.remove();
      existing.delete(messageId);
    }
  }

  let cursor = systemNode ? systemNode.nextSibling : feed.firstChild;

  for (const message of channel.messages) {
    let node = existing.get(message.id);
    if (!node) {
      node = createMessageItem(message, {
        open: state.openMessageId === message.id
      });
      attachMessageToggle(node, message.id, setState);
      existing.set(message.id, node);
    } else {
      syncTraceState(node, state.openMessageId === message.id);
    }

    if (cursor !== node) {
      feed.insertBefore(node, cursor);
    }
    cursor = node.nextSibling;
  }
}
