import { createMessageList, updateMessageList } from "./message-list.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getChannelMetrics(channel) {
  const messages = Array.isArray(channel.messages) ? channel.messages : [];
  const reactions = Array.isArray(channel.reactions) ? channel.reactions : [];
  const timeline = Array.isArray(channel.timeline) ? channel.timeline : [];
  const latestItem = timeline[timeline.length - 1];
  const latestTimestamp =
    latestItem?.message?.timestamp ||
    latestItem?.reaction?.timestamp ||
    messages[messages.length - 1]?.timestamp ||
    "";

  return {
    messageCount: messages.length,
    reactionCount: reactions.length,
    pinnedCount: Array.isArray(channel.pinnedMessages) ? channel.pinnedMessages.length : 0,
    latestTimestamp
  };
}

function renderObserverFooter(channel) {
  const hasTrace = (channel.messages || []).some((message) => message.trace);
  return hasTrace ? "observer mode · click messages to inspect reasoning" : "observer mode · live session mirror";
}

function createHeader(channel) {
  const header = document.createElement("header");
  header.className = "channel-panel-header";
  header.innerHTML = renderHeaderMarkup(channel);
  return header;
}

function renderPinnedMessages(channel) {
  if (!Array.isArray(channel.pinnedMessages) || !channel.pinnedMessages.length) {
    return "";
  }

  return `
    <div class="channel-pins">
      <div class="channel-pins-label">Pinned</div>
      <div class="channel-pins-list">
        ${channel.pinnedMessages
          .map(
            (message) => `
          <div class="channel-pin-item" data-message-id="${message.id}">
            <span class="channel-pin-author">${escapeHtml(message.actorName || "Unknown")}</span>
            <span class="channel-pin-text">${escapeHtml(message.text || message.type || message.id)}</span>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderHeaderMarkup(channel) {
  const metrics = getChannelMetrics(channel);
  return `
    <div class="channel-panel-eyebrow">observer feed</div>
    <div class="channel-panel-title-row">
      <div class="channel-panel-title-group">
        <div class="channel-panel-title">${channel.prefix === "#" ? "#" : ""}${escapeHtml(channel.label)}</div>
        <span class="channel-panel-count">${escapeHtml(channel.members)} members</span>
        <span class="meta-chip">${escapeHtml(channel.visibility)}</span>
        ${metrics.pinnedCount ? `<span class="meta-chip meta-chip-pin">${escapeHtml(metrics.pinnedCount)} pinned</span>` : ""}
      </div>
    </div>
    ${
      channel.topic
        ? `<p class="channel-topic">${escapeHtml(channel.topic)}</p>`
        : `<p class="channel-topic is-empty">No topic set for this channel yet.</p>`
    }
    <div class="channel-meta-grid">
      <div class="channel-meta-card">
        <span class="channel-meta-label">messages</span>
        <strong class="channel-meta-value">${escapeHtml(metrics.messageCount)}</strong>
      </div>
      <div class="channel-meta-card">
        <span class="channel-meta-label">reactions</span>
        <strong class="channel-meta-value">${escapeHtml(metrics.reactionCount)}</strong>
      </div>
      <div class="channel-meta-card">
        <span class="channel-meta-label">latest</span>
        <strong class="channel-meta-value">${escapeHtml(metrics.latestTimestamp || "quiet")}</strong>
      </div>
    </div>
    ${renderPinnedMessages(channel)}
  `;
}

export function createChannelPanel(channel, state, setState) {
  const panel = document.createElement("section");
  panel.className = "main-panel";
  panel.appendChild(createHeader(channel));
  panel.appendChild(createMessageList(channel, state, setState));

  const footer = document.createElement("div");
  footer.className = "observer-footer";
  footer.textContent = renderObserverFooter(channel);
  panel.appendChild(footer);

  return panel;
}

export function updateChannelPanel(panel, channel, state, setState) {
  const header = panel.querySelector(".channel-panel-header");
  const feed = panel.querySelector(".channel-feed");
  const footer = panel.querySelector(".observer-footer");

  if (header) {
    header.innerHTML = renderHeaderMarkup(channel);
  }
  if (feed) {
    updateMessageList(feed, channel, state, setState);
  }
  if (footer) {
    footer.textContent = renderObserverFooter(channel);
  }
}
