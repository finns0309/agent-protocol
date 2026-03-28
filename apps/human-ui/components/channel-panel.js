import { createMessageList, updateMessageList } from "./message-list.js";

function createHeader(channel) {
  const header = document.createElement("header");
  header.className = "channel-panel-header";
  header.innerHTML = `
    <div class="channel-panel-title-row">
      <div class="channel-panel-title-group">
        <div class="channel-panel-title">${channel.prefix === "#" ? "#" : ""}${channel.label}</div>
        <span class="channel-panel-count">${channel.members} members</span>
        <span class="meta-chip">${channel.visibility}</span>
      </div>
      <div class="channel-panel-actions">
        <button class="header-action is-active" type="button">traces</button>
        <button class="header-action" type="button">types</button>
      </div>
    </div>
  `;
  return header;
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
  const title = panel.querySelector(".channel-panel-title");
  const count = panel.querySelector(".channel-panel-count");
  const chip = panel.querySelector(".meta-chip");
  const feed = panel.querySelector(".channel-feed");

  if (title) {
    title.textContent = `${channel.prefix === "#" ? "#" : ""}${channel.label}`;
  }
  if (count) {
    count.textContent = `${channel.members} members`;
  }
  if (chip) {
    chip.textContent = channel.visibility;
  }
  if (feed) {
    updateMessageList(feed, channel, state, setState);
  }
}
