import {
  enqueueOperation,
  getLocalNotesForUser,
  saveLocalNoteVersion,
  upsertLocalNoteForUser,
} from "./localNotesStore";
import { remapInternalLinks } from "./dataPortability";
import { getNoteReference } from "./noteLinks";
import { requestSync } from "./syncEngine";

function getUserId(userId) {
  return String(userId || "").trim();
}

function operationId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localNoteId() {
  return `local-${operationId()}`;
}

function now() {
  return new Date().toISOString();
}

async function queueNoteMutation(userId, note, operation) {
  const normalizedUserId = getUserId(userId);
  if (!normalizedUserId) throw new Error("Authenticated user is required");
  const timestamp = now();
  const nextNote = {
    ...note,
    userId: normalizedUserId,
    localUpdatedAt: timestamp,
    updatedAt: note.preserveUpdatedAt ? note.updatedAt : timestamp,
    localOnly: note.localOnly ?? true,
  };
  const scope = await upsertLocalNoteForUser(normalizedUserId, nextNote);
  const queued = await enqueueOperation(normalizedUserId, {
    ...operation,
    noteId: nextNote._id,
    payload: { ...operation.payload, noteId: nextNote._id },
  });
  requestSync(normalizedUserId);
  return { note: nextNote, scope, operation: queued };
}

export async function createNoteLocally(userId, values) {
  const id = values.clientNoteId || localNoteId();
  const createdAt = values.createdAt || now();
  return queueNoteMutation(
    userId,
    {
      _id: id,
      id,
      title: values.title,
      content: values.content,
      tags: values.tags || [],
      isPinned: Boolean(values.isPinned),
      isFavorite: Boolean(values.isFavorite),
      deletedAt: null,
      createdAt,
      revision: 0,
      clientNoteId: id,
      preserveUpdatedAt: Boolean(values.updatedAt),
      localOnly: true,
    },
    {
      type: "CREATE_NOTE",
      clientNoteId: id,
      payload: {
        title: values.title,
        content: values.content,
        tags: values.tags || [],
        clientNoteId: id,
        isPinned: Boolean(values.isPinned),
        isFavorite: Boolean(values.isFavorite),
      },
    },
  );
}

export async function importNotesLocally(userId, records, options = {}) {
  const normalizedUserId = getUserId(userId);
  if (!normalizedUserId) throw new Error("Authenticated user is required");
  const { notes: existingNotes, trash: existingTrash } = await getLocalNotesForUser(normalizedUserId);
  const existing = [...existingNotes, ...existingTrash];
  const duplicateMode = options.duplicateMode === "skip" ? "skip" : "copy";
  const idMap = new Map();
  const planned = records.map((record) => {
    const duplicate = existing.find(
      (note) =>
        String(note.title || "").trim().toLowerCase() === String(record.title || "").trim().toLowerCase() &&
        String(note.content || "") === String(record.content || ""),
    );
    if (duplicate && duplicateMode === "skip") {
      idMap.set(record.sourceId, getNoteReference(duplicate));
      return { record, duplicate };
    }
    const importedId = localNoteId();
    idMap.set(record.sourceId, importedId);
    return { record, importedId };
  });

  const imported = [];
  const skipped = [];
  for (let index = 0; index < planned.length; index += 1) {
    const { record, duplicate, importedId } = planned[index];
    if (duplicate) {
      skipped.push(record);
      options.onProgress?.(index + 1, planned.length);
      continue;
    }
    const result = await createNoteLocally(normalizedUserId, {
      clientNoteId: importedId,
      title: record.title,
      content: remapInternalLinks(record.content, idMap),
      tags: record.tags,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      isPinned: record.isPinned,
      isFavorite: record.isFavorite,
    });
    let importedNote = result.note;
    if (record.deletedAt) importedNote = (await trashNoteLocally(normalizedUserId, importedNote)).note;
    imported.push(importedNote);
    options.onProgress?.(index + 1, planned.length);
  }
  return { imported, skipped, idMap };
}

export async function updateNoteLocally(userId, note, values) {
  await saveLocalNoteVersion(userId, note, "UPDATE_NOTE");
  const nextNote = { ...note, ...values };
  return queueNoteMutation(userId, nextNote, {
    type: "UPDATE_NOTE",
    baseRevision: Number(note.revision || 1),
    coalesceKey: `update:${note._id}`,
    payload: {
      title: nextNote.title,
      content: nextNote.content,
      tags: nextNote.tags || [],
      isPinned: Boolean(nextNote.isPinned),
      isFavorite: Boolean(nextNote.isFavorite),
    },
  });
}

export async function trashNoteLocally(userId, note) {
  await saveLocalNoteVersion(userId, note, "DELETE_NOTE");
  return queueNoteMutation(
    userId,
    { ...note, deletedAt: now() },
    {
      type: "DELETE_NOTE",
      baseRevision: Number(note.revision || 1),
      payload: {},
    },
  );
}

export async function restoreNoteLocally(userId, note) {
  await saveLocalNoteVersion(userId, note, "RESTORE_NOTE");
  return queueNoteMutation(
    userId,
    { ...note, deletedAt: null },
    {
      type: "RESTORE_NOTE",
      baseRevision: Number(note.revision || 1),
      payload: {},
    },
  );
}

export async function getLocalNote(userId, noteId) {
  const scope = await getLocalNotesForUser(getUserId(userId));
  return [...scope.notes, ...scope.trash].find(
    (note) => (note._id || note.id) === noteId,
  );
}
