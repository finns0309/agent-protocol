import { createMessageList, updateMessageList } from "./message-list.js";

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
            <span class="channel-pin-author">${message.actorName}</span>
            <span class="channel-pin-text">${message.text || message.type || message.id}</span>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderHeaderMarkup(channel) {
  const topic = channel.topic || "Observer transcript and reasoning-aware chat flow";
  return `
    <div class="channel-panel-title-row">
      <div class="channel-panel-title-group">
        <div class="channel-panel-title">${channel.prefix === "#" ? "#" : ""}${channel.label}</div>
      </div>
      <div class="channel-panel-actions">
        <span class="meta-chip meta-chip-live">live sync</span>
        <span class="meta-chip">show reasoning</span>
      </div>
    </div>
    <div class="channel-panel-meta-row">
      <div class="channel-panel-topic">${topic}</div>
      <div class="channel-panel-meta-chips">
        <span class="meta-chip">${channel.members} members</span>
        <span class="meta-chip">${channel.visibility}</span>
        ${channel.pinnedMessages?.length ? `<span class="meta-chip meta-chip-pin">${channel.pinnedMessages.length} pinned</span>` : ""}
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
  footer.textContent = "protocol runtime · observer only";
  panel.appendChild(footer);

  return panel;
}

export function updateChannelPanel(panel, channel, state, setState) {
  const header = panel.querySelector(".channel-panel-header");
  const feed = panel.querySelector(".channel-feed");

  if (header) {
    header.innerHTML = renderHeaderMarkup(channel);
  }
  if (feed) {
    updateMessageList(feed, channel, state, setState);
  }
}
