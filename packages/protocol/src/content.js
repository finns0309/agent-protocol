import {
  assertArray,
  assertObject,
  assertOptionalNumber,
  assertOptionalObject,
  assertOptionalString,
  assertString,
  clone
} from "./utils.js";

export const ContentBlockTypes = {
  TEXT: "text",
  MARKDOWN: "markdown",
  IMAGE: "image",
  AUDIO: "audio",
  VIDEO: "video",
  FILE: "file"
};

const BLOCK_TYPES = new Set(Object.values(ContentBlockTypes));

function validateBlockType(type) {
  assertString(type, "contentBlock.type");
  if (!BLOCK_TYPES.has(type)) {
    throw new Error(`Unsupported content block type: ${type}`);
  }
}

export function createContentBlock(spec) {
  assertObject(spec, "contentBlock");
  validateBlockType(spec.type);
  assertOptionalString(spec.text, "contentBlock.text");
  assertOptionalString(spec.url, "contentBlock.url");
  assertOptionalString(spec.title, "contentBlock.title");
  assertOptionalString(spec.alt, "contentBlock.alt");
  assertOptionalString(spec.mimeType, "contentBlock.mimeType");
  assertOptionalString(spec.posterUrl, "contentBlock.posterUrl");
  assertOptionalNumber(spec.durationSeconds, "contentBlock.durationSeconds");
  assertOptionalObject(spec.metadata, "contentBlock.metadata");

  if (
    (spec.type === ContentBlockTypes.TEXT || spec.type === ContentBlockTypes.MARKDOWN) &&
    !String(spec.text || "").trim()
  ) {
    throw new Error(`${spec.type} content blocks require non-empty text.`);
  }

  if (
    [ContentBlockTypes.IMAGE, ContentBlockTypes.AUDIO, ContentBlockTypes.VIDEO, ContentBlockTypes.FILE].includes(spec.type) &&
    !String(spec.url || "").trim()
  ) {
    throw new Error(`${spec.type} content blocks require a url.`);
  }

  return clone({
    type: spec.type,
    text: spec.text || "",
    url: spec.url || "",
    title: spec.title || "",
    alt: spec.alt || "",
    mimeType: spec.mimeType || "",
    posterUrl: spec.posterUrl || "",
    durationSeconds: spec.durationSeconds ?? null,
    metadata: spec.metadata || {}
  });
}

export function extractTextFromContent(content = []) {
  if (!Array.isArray(content) || content.length === 0) {
    return "";
  }

  return content
    .map((block) => {
      if (!block || typeof block !== "object") {
        return "";
      }
      if (block.type === ContentBlockTypes.TEXT || block.type === ContentBlockTypes.MARKDOWN) {
        return String(block.text || "");
      }
      if (block.title) {
        return `[${block.type}] ${block.title}`;
      }
      if (block.url) {
        return `[${block.type}] ${block.url}`;
      }
      return `[${block.type}]`;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function createMessagePayload(spec = {}) {
  assertObject(spec, "messagePayload");
  assertOptionalString(spec.text, "messagePayload.text");

  const rawContent = spec.content ?? spec.blocks ?? [];
  assertArray(rawContent, "messagePayload.content");

  let content = rawContent.map((block) => createContentBlock(block));
  let text = spec.text || "";

  if (!content.length && text) {
    content = [createContentBlock({ type: ContentBlockTypes.MARKDOWN, text })];
  }

  if (!text && content.length) {
    text = extractTextFromContent(content);
  }

  return clone({
    text,
    content
  });
}

export function extractTextFromPayload(payload = {}) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  if (typeof payload.text === "string" && payload.text.length > 0) {
    return payload.text;
  }
  return extractTextFromContent(payload.content || payload.blocks || []);
}
