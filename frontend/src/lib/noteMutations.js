import {
  enqueueOperation,
  getLocalNotesForUser,
  upsertLocalNoteForUser,
} from "./localNotesStore";
import { requestSync } from "./syncEngine";

function getUserId(userId) {
  return String(userId || "").trim();
}

function operationId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
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
    updatedAt: timestamp,
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
  const id = localNoteId();
  return queueNoteMutation(userId, {
    _id: id,
    id,
    title: values.title,
    content: values.content,
    tags: values.tags || [],
    isPinned: false,
    isFavorite: false,
    deletedAt: null,
    createdAt: now(),
    revision: 0,
    clientNoteId: id,
    localOnly: true,
  }, {
    type: "CREATE_NOTE",
    clientNoteId: id,
    payload: {
      title: values.title,
      content: values.content,
      tags: values.tags || [],
      clientNoteId: id,
    },
  });
}

export async function updateNoteLocally(userId, note, values) {
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
  return queueNoteMutation(userId, { ...note, deletedAt: now() }, {
    type: "DELETE_NOTE",
    baseRevision: Number(note.revision || 1),
    payload: {},
  });
}

export async function restoreNoteLocally(userId, note) {
  return queueNoteMutation(userId, { ...note, deletedAt: null }, {
    type: "RESTORE_NOTE",
    baseRevision: Number(note.revision || 1),
    payload: {},
  });
}

export async function getLocalNote(userId, noteId) {
  const scope = await getLocalNotesForUser(getUserId(userId));
  return [...scope.notes, ...scope.trash].find(
    (note) => (note._id || note.id) === noteId,
  );
}
