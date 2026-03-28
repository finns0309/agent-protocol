function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createMessageMarkup(message) {
  const badge =
    message.type && message.type !== "chat"
      ? `<span class="message-badge badge-${message.type}">${escapeHtml(message.type)}</span>`
      : "";

  return `
    <div class="channel-card-message">
      <div class="channel-card-message-head">
        <div class="avatar" style="background:${escapeHtml(message.avatarColor)};width:22px;height:22px;font-size:10px;">${escapeHtml(message.avatar)}</div>
        <span class="message-name" style="font-size:12px;">${escapeHtml(message.actorName)}</span>
        <span class="message-time" style="font-size:10px;">${escapeHtml(message.timestamp)}</span>
        ${badge}
      </div>
      <div class="channel-card-text">${escapeHtml(message.text)}</div>
    </div>
  `;
}

function createChannelCard(channel, note) {
  const panel = document.createElement("article");
  panel.className = "channel-card";
  panel.innerHTML = `
    <div class="channel-card-header">
      <span class="channel-prefix">${escapeHtml(channel.prefix)}</span>
      <span class="channel-name">${escapeHtml(channel.label)}</span>
      <span class="channel-card-tag">${escapeHtml(channel.visibility)}</span>
    </div>
    <div class="channel-card-body">
      ${channel.messages.slice(0, 3).map(createMessageMarkup).join("")}
    </div>
    <div class="channel-card-note">${escapeHtml(note)}</div>
  `;
  return panel;
}

export function createChannelContrastPanel(session) {
  const publicChannel = session.channels.find((channel) => channel.visibility === "public");
  const privateChannel = session.channels.find((channel) => channel.visibility === "private");

  const panel = document.createElement("section");
  panel.className = "rail-section contrast-panel";
  panel.innerHTML = `
    <h2 class="panel-title-sm">Public vs private channels</h2>
    <p class="panel-copy">The same protocol can host open onboarding in public and candid risk evaluation in private without changing message primitives.</p>
    <div class="contrast-grid"></div>
  `;

  const grid = panel.querySelector(".contrast-grid");
  if (publicChannel) {
    grid.appendChild(createChannelCard(publicChannel, session.contrast.publicNote));
  }
  if (privateChannel) {
    grid.appendChild(createChannelCard(privateChannel, session.contrast.privateNote));
  }

  return panel;
}
