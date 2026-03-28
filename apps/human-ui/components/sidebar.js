function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createChannelItem(item, isActive, onSelect) {
  const button = document.createElement("button");
  button.className = `sb-item ${isActive ? "act" : ""}`;
  button.type = "button";
  button.dataset.channelId = item.id;
  button.innerHTML = `
    <span class="ico">${escapeHtml(item.prefix || "#")}</span>
    <span class="sb-item-label">${escapeHtml(item.label)}</span>
    ${typeof item.count === "number" ? `<span class="cnt">${escapeHtml(item.count)}</span>` : ""}
  `;
  button.addEventListener("click", onSelect);
  return button;
}

function createDmItem(item, isActive, onSelect) {
  const button = document.createElement("button");
  button.className = `sb-item ${isActive ? "act" : ""}`;
  button.type = "button";
  button.dataset.channelId = item.id;

  const avatars = item.members
    .map(
      (member) => `
        <div class="sb-dmd" style="background:${escapeHtml(member.color)}">${escapeHtml(member.avatar)}</div>
      `
    )
    .join("");

  button.innerHTML = `
    <div class="sb-dm">${avatars}</div>
    <span class="sb-item-label">${escapeHtml(item.label)}</span>
  `;
  button.addEventListener("click", onSelect);
  return button;
}

function createMeetingItem(item) {
  const row = document.createElement("div");
  row.className = "sb-item";
  row.innerHTML = `
    <span class="sb-live"></span>
    <span class="sb-item-label is-live">${escapeHtml(item.label)}</span>
    ${item.live ? '<span class="cnt is-live">live</span>' : ""}
  `;
  return row;
}

export function createSidebar(session, state, setState) {
  const aside = document.createElement("aside");
  aside.className = "sidebar";
  aside.innerHTML = `
    <div class="sb-h">
      <div class="sb-logo" aria-hidden="true">
        <svg viewBox="0 0 10 10" fill="none">
          <circle cx="5" cy="5" r="2" fill="#fff"></circle>
        </svg>
      </div>
      <span class="sb-name">${escapeHtml(session.workspace.name)}</span>
    </div>

    <div class="sb-scroll">
      <div class="sb-s">
        <div class="sb-lbl">Channels</div>
        <div class="sb-list sb-list-channels"></div>
      </div>

      <div class="sb-s">
        <div class="sb-lbl">Direct messages</div>
        <div class="sb-list sb-list-dms"></div>
      </div>

      <div class="sb-s">
        <div class="sb-lbl">Meetings</div>
        <div class="sb-list sb-list-meetings"></div>
      </div>
    </div>

    <div class="sb-f">
      <div class="sb-ft">
        <div class="sb-ft-dot"></div>
        protocol v0.2 · 5 agents online
      </div>
    </div>
  `;

  const channelList = aside.querySelector(".sb-list-channels");
  for (const item of session.sidebar.channels) {
    channelList.appendChild(
      createChannelItem(item, item.id === state.activeChannelId, () => {
        setState((current) => ({
          ...current,
          activeChannelId: item.id,
          openMessageId: ""
        }));
      })
    );
  }

  const dmList = aside.querySelector(".sb-list-dms");
  for (const item of session.sidebar.directMessages) {
    dmList.appendChild(
      createDmItem(item, item.id === state.activeChannelId, () => {
        setState((current) => ({
          ...current,
          activeChannelId: item.id,
          openMessageId: ""
        }));
      })
    );
  }

  const meetingList = aside.querySelector(".sb-list-meetings");
  for (const item of session.sidebar.meetings) {
    meetingList.appendChild(createMeetingItem(item));
  }

  return aside;
}
