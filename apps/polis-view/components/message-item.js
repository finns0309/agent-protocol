function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sanitizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw, window.location.origin);
    if (["http:", "https:", "data:", "blob:"].includes(parsed.protocol)) {
      return parsed.toString();
    }
  } catch {
    return "";
  }

  return "";
}

function restoreTokens(text, tokens) {
  return text.replace(/@@TOKEN_(\d+)@@/g, (_, index) => tokens[Number(index)] || "");
}

function renderInlineMarkdown(text) {
  const tokens = [];
  let html = escapeHtml(text);

  html = html.replace(/`([^`]+)`/g, (_, code) => {
    const token = `@@TOKEN_${tokens.length}@@`;
    tokens.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const safeUrl = sanitizeUrl(url);
    if (!safeUrl) {
      return escapeHtml(label);
    }
    const token = `@@TOKEN_${tokens.length}@@`;
    tokens.push(`<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`);
    return token;
  });

  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^\*])\*([^*]+)\*/g, "$1<em>$2</em>");

  return restoreTokens(html, tokens);
}

function renderMarkdownBlocks(text) {
  const source = String(text || "");
  const blocks = [];
  const fenceRegex = /```([a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match;

  while ((match = fenceRegex.exec(source))) {
    if (match.index > cursor) {
      blocks.push({ type: "markdown", text: source.slice(cursor, match.index) });
    }
    blocks.push({
      type: "code",
      language: match[1] || "",
      text: match[2] || ""
    });
    cursor = fenceRegex.lastIndex;
  }

  if (cursor < source.length) {
    blocks.push({ type: "markdown", text: source.slice(cursor) });
  }

  return blocks
    .map((block) => {
      if (block.type === "code") {
        const languageClass = block.language ? ` class="language-${escapeHtml(block.language)}"` : "";
        return `<pre class="rich-code"><code${languageClass}>${escapeHtml(block.text.trimEnd())}</code></pre>`;
      }

      return renderMarkdownFragment(block.text);
    })
    .join("");
}

function renderMarkdownFragment(text) {
  const lines = String(text || "").split("\n");
  const parts = [];
  let paragraph = [];
  let list = null;

  function flushParagraph() {
    if (!paragraph.length) {
      return;
    }
    parts.push(`<p>${paragraph.map((line) => renderInlineMarkdown(line)).join("<br>")}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list || !list.items.length) {
      list = null;
      return;
    }
    const tag = list.type === "ordered" ? "ol" : "ul";
    parts.push(`<${tag}>${list.items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</${tag}>`);
    list = null;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      parts.push(`<h${level + 1}>${renderInlineMarkdown(headingMatch[2])}</h${level + 1}>`);
      continue;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (!list || list.type !== "unordered") {
        flushList();
        list = { type: "unordered", items: [] };
      }
      list.items.push(unordered[1]);
      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (!list || list.type !== "ordered") {
        flushList();
        list = { type: "ordered", items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  return parts.join("");
}

function renderContentBlock(block) {
  if (!block || typeof block !== "object") {
    return "";
  }

  if (block.type === "text" || block.type === "markdown") {
    return `<div class="message-block message-block-text">${renderMarkdownBlocks(block.text || "")}</div>`;
  }

  if (block.type === "image") {
    const safeUrl = sanitizeUrl(block.url);
    return `
      <figure class="message-block media-card">
        ${safeUrl ? `<img class="media-preview" src="${escapeHtml(safeUrl)}" alt="${escapeHtml(block.alt || block.title || "image")}" />` : ""}
        <figcaption>
          <span class="media-kind">image</span>
          ${block.title ? `<span class="media-title">${escapeHtml(block.title)}</span>` : ""}
        </figcaption>
      </figure>
    `;
  }

  if (block.type === "audio") {
    const safeUrl = sanitizeUrl(block.url);
    return `
      <div class="message-block media-card">
        <div class="media-head">
          <span class="media-kind">audio</span>
          ${block.title ? `<span class="media-title">${escapeHtml(block.title)}</span>` : ""}
        </div>
        ${safeUrl ? `<audio class="media-audio" controls preload="none" src="${escapeHtml(safeUrl)}"></audio>` : ""}
      </div>
    `;
  }

  if (block.type === "video") {
    const safeUrl = sanitizeUrl(block.url);
    const posterUrl = sanitizeUrl(block.posterUrl);
    return `
      <div class="message-block media-card">
        <div class="media-head">
          <span class="media-kind">video</span>
          ${block.title ? `<span class="media-title">${escapeHtml(block.title)}</span>` : ""}
        </div>
        ${safeUrl ? `<video class="media-video" controls preload="metadata" ${posterUrl ? `poster="${escapeHtml(posterUrl)}"` : ""} src="${escapeHtml(safeUrl)}"></video>` : ""}
      </div>
    `;
  }

  if (block.type === "file") {
    const safeUrl = sanitizeUrl(block.url);
    return `
      <div class="message-block media-card media-file">
        <div class="media-head">
          <span class="media-kind">file</span>
          ${block.title ? `<span class="media-title">${escapeHtml(block.title)}</span>` : ""}
        </div>
        ${safeUrl ? `<a class="media-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${escapeHtml(block.url)}</a>` : ""}
      </div>
    `;
  }

  return "";
}

function renderMessageContent(message) {
  const blocks = Array.isArray(message.content) && message.content.length
    ? message.content
    : (message.text ? [{ type: "markdown", text: message.text }] : []);

  return blocks.map((block) => renderContentBlock(block)).join("");
}

function traceStepMarkup(step) {
  const value =
    step.kind === "tool"
      ? `<span class="trace-tool">${escapeHtml(step.value)}</span>`
      : `<span class="trace-value ${step.tone === "muted" ? "is-muted" : ""}">${escapeHtml(step.value)}</span>`;

  return `
    <div class="trace-step">
      <div class="trace-label">${escapeHtml(step.label)}</div>
      <div>${value}</div>
    </div>
  `;
}

function renderReplyPreview(message) {
  if (!message.replyPreview) {
    return "";
  }

  return `
    <div class="message-reply-preview">
      <span class="message-reply-label">Reply to</span>
      <span class="message-reply-author">${escapeHtml(message.replyPreview.actorName || message.replyPreview.actorId || "unknown")}</span>
      <span class="message-reply-text">${escapeHtml(message.replyPreview.text || message.replyPreview.type || message.replyPreview.id)}</span>
    </div>
  `;
}

function renderMentionChips(message) {
  if (!Array.isArray(message.mentionedIds) || !message.mentionedIds.length) {
    return "";
  }

  return `
    <div class="message-mentions">
      ${message.mentionedIds
        .map((mention) => `<span class="mention-chip">@${escapeHtml(mention)}</span>`)
        .join("")}
    </div>
  `;
}

function renderMessageInspector(message, open) {
  if (!message.trace) {
    return "";
  }

  return `
    <div class="message-inspector-row">
      <span class="message-inspector-label">Reasoning Trace</span>
      <span class="message-inspector-meta">${escapeHtml(message.trace.title || "trigger → thought → tools → action")}</span>
    </div>
  `;
}

export function createMessageItem(message, { open = false } = {}) {
  const article = document.createElement("article");
  article.className = `message msg-${message.type || "chat"} ${message.trace ? "has-trace" : ""} ${open ? "is-open" : ""}`;
  article.dataset.messageId = message.id;

  const badgeClass = {
    announce: "badge-announce",
    negotiate: "badge-negotiate",
    request: "badge-offer",
    offer: "badge-offer",
    route: "badge-route",
    deliver: "badge-deliver",
    confirm: "badge-confirm",
    react: "badge-react"
  }[message.type] || "badge-chat";

  article.innerHTML = `
    <div class="message-head">
      <div class="avatar" style="background:${escapeHtml(message.avatarColor)}">${escapeHtml(message.avatar)}</div>
      <span class="message-name">${escapeHtml(message.actorName)}</span>
      <span class="message-time">${escapeHtml(message.timestamp)}</span>
      ${message.type ? `<span class="message-badge ${badgeClass}">${escapeHtml(message.type)}</span>` : ""}
    </div>
    ${renderReplyPreview(message)}
    ${renderMentionChips(message)}
    <div class="message-content-shell">
      <div class="message-text">${renderMessageContent(message)}</div>
    </div>
    ${renderMessageInspector(message, open)}
    ${
      message.trace
        ? `
      <div class="message-trace ${open ? "is-open" : ""}">
        <div class="trace-title">${escapeHtml(message.trace.title)}</div>
        ${message.trace.steps
          .map((step, index) => `${traceStepMarkup(step)}${index < message.trace.steps.length - 1 ? '<div class="trace-separator"></div>' : ""}`)
          .join("")}
      </div>
    `
        : ""
    }
  `;

  return article;
}

export function createReactionItem(reaction) {
  const article = document.createElement("article");
  article.className = "message message-reaction-event";
  article.dataset.reactionId = reaction.id;
  article.innerHTML = `
    <div class="message-head">
      <div class="avatar" style="background:${escapeHtml(reaction.avatarColor)}">${escapeHtml(reaction.avatar)}</div>
      <span class="message-name">${escapeHtml(reaction.actorName)}</span>
      <span class="message-time">${escapeHtml(reaction.timestamp)}</span>
      <span class="message-badge badge-react">${escapeHtml(reaction.reactionType || "react")}</span>
    </div>
    ${
      reaction.targetMessagePreview
        ? `<div class="message-reply-preview is-reaction-target">
            <span class="message-reply-label">On</span>
            <span class="message-reply-author">${escapeHtml(reaction.targetMessagePreview.actorName || reaction.targetMessagePreview.actorId || "unknown")}</span>
            <span class="message-reply-text">${escapeHtml(reaction.targetMessagePreview.text || reaction.targetMessagePreview.type || reaction.targetMessagePreview.id)}</span>
          </div>`
        : ""
    }
    ${
      reaction.summary
        ? `<div class="message-content-shell">
            <div class="message-text reaction-text">${renderMarkdownBlocks(reaction.summary)}</div>
          </div>`
        : ""
    }
  `;
  return article;
}
