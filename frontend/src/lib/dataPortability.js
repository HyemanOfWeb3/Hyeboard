import { parseInternalLinks } from "./noteLinks";

export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORTED_NOTES = 5000;
const MAX_TEXT_LENGTH = 1_000_000;
const MARKDOWN_NOTE_MARKER = "<!-- HYEBOARD NOTE -->";

function cleanText(value, field, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") throw new Error(`${field} must be text`);
  if (value.length > maxLength) throw new Error(`${field} is too large`);
  if (
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return (
        (code >= 0 && code <= 8) ||
        code === 11 ||
        code === 12 ||
        (code >= 14 && code <= 31)
      );
    })
  ) {
    throw new Error(`${field} contains unsupported control characters`);
  }
  if (/<\s*script\b/i.test(value) || /javascript\s*:/i.test(value)) {
    throw new Error(`${field} contains unsafe script content`);
  }
  return value;
}

function cleanDate(value, fallback) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid note timestamp");
  return date.toISOString();
}

function cleanTags(value) {
  const tags = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return Array.from(
    new Set(
      tags
        .map((tag) => cleanText(String(tag).trim(), "Tag", 120))
        .filter(Boolean),
    ),
  ).slice(0, 50);
}

function normalizeRecord(record, index, isTrash = false) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error(`Note ${index + 1} is malformed`);
  }
  const title = cleanText(
    record.title || "Untitled note",
    "Note title",
    500,
  ).trim();
  const content = cleanText(record.content || "", "Note content");
  if (!title && !content) throw new Error(`Note ${index + 1} is empty`);
  const sourceId = cleanText(
    String(
      record.sourceId ||
        record.clientNoteId ||
        record.id ||
        record._id ||
        `import-${index + 1}`,
    ),
    "Note ID",
    200,
  );
  return {
    sourceId,
    title: title || "Untitled note",
    content,
    tags: cleanTags(record.tags),
    createdAt: cleanDate(record.createdAt, new Date().toISOString()),
    updatedAt: cleanDate(
      record.updatedAt,
      cleanDate(record.createdAt, new Date().toISOString()),
    ),
    isPinned: Boolean(record.isPinned),
    isFavorite: Boolean(record.isFavorite),
    deletedAt:
      isTrash || record.deletedAt
        ? cleanDate(record.deletedAt, new Date().toISOString())
        : null,
    internalLinks: parseInternalLinks(content).map(({ label, reference }) => ({
      label,
      reference,
    })),
  };
}

export function createBackup(notes = [], trash = []) {
  return {
    format: "hyeboard-backup",
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    notes: notes
      .filter(Boolean)
      .map((note, index) => normalizeRecord(note, index)),
    trash: trash
      .filter(Boolean)
      .map((note, index) => normalizeRecord(note, index, true)),
  };
}

function quote(value) {
  return JSON.stringify(value);
}

function serializeMarkdownNote(note, index) {
  const normalized = normalizeRecord(note, index, Boolean(note.deletedAt));
  return [
    "---",
    `title: ${quote(normalized.title)}`,
    `tags: ${quote(normalized.tags)}`,
    `createdAt: ${quote(normalized.createdAt)}`,
    `updatedAt: ${quote(normalized.updatedAt)}`,
    `isPinned: ${normalized.isPinned}`,
    `isFavorite: ${normalized.isFavorite}`,
    `sourceId: ${quote(normalized.sourceId)}`,
    `deletedAt: ${quote(normalized.deletedAt || "")}`,
    "---",
    "",
    normalized.content,
  ].join("\n");
}

export function createMarkdown(notes = []) {
  return notes
    .filter(Boolean)
    .map(serializeMarkdownNote)
    .join(`\n\n${MARKDOWN_NOTE_MARKER}\n\n`);
}

function parseFrontmatterValue(value, fallback) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function parseMarkdownBlock(block, index) {
  const match = block.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match)
    throw new Error(`Markdown note ${index + 1} is missing valid frontmatter`);
  const frontmatter = {};
  match[1].split("\n").forEach((line) => {
    const separator = line.indexOf(":");
    if (separator < 1)
      throw new Error(`Markdown note ${index + 1} has invalid frontmatter`);
    frontmatter[line.slice(0, separator).trim()] = parseFrontmatterValue(
      line.slice(separator + 1),
      "",
    );
  });
  return normalizeRecord(
    { ...frontmatter, content: match[2] },
    index,
    Boolean(frontmatter.deletedAt),
  );
}

export function parseImportText(text, fileName = "import") {
  if (typeof text !== "string") throw new Error("Import data must be text");
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES)
    throw new Error("Import file is too large");
  const isJson =
    fileName.toLowerCase().endsWith(".json") ||
    text.trim().startsWith("{") ||
    text.trim().startsWith("[");
  if (isJson) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("JSON file is malformed");
    }
    if (
      !parsed ||
      parsed.format !== "hyeboard-backup" ||
      parsed.schemaVersion !== BACKUP_SCHEMA_VERSION
    ) {
      throw new Error("Unsupported HyeBoard backup format");
    }
    const notes = Array.isArray(parsed.notes) ? parsed.notes : [];
    const trash = Array.isArray(parsed.trash) ? parsed.trash : [];
    if (notes.length + trash.length > MAX_IMPORTED_NOTES)
      throw new Error("Import contains too many notes");
    return [
      ...notes.map((note, index) => normalizeRecord(note, index)),
      ...trash.map((note, index) => normalizeRecord(note, index, true)),
    ];
  }
  const blocks = text.split(`\n\n${MARKDOWN_NOTE_MARKER}\n\n`);
  if (blocks.length > MAX_IMPORTED_NOTES)
    throw new Error("Import contains too many notes");
  return blocks.filter((block) => block.trim()).map(parseMarkdownBlock);
}

export function remapInternalLinks(content, idMap) {
  return content.replace(
    /\[([^\]]+)\]\(\/note\/([^)]+)\)/g,
    (match, label, reference) => {
      const decoded = decodeURIComponent(reference);
      const mapped = idMap.get(decoded);
      return mapped ? `[${label}](/note/${encodeURIComponent(mapped)})` : match;
    },
  );
}

export function downloadText(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
