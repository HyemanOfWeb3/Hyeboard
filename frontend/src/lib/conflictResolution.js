import { requestSync } from "./syncEngine";
import {
  deleteOperation,
  getConflictForNote,
  getLocalNoteForUser,
  enqueueOperation,
  updateConflict,
  upsertLocalNoteForUser,
} from "./localNotesStore";

function newOperationId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return `resolve-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function updatePayload(note) {
  return {
    title: note.title,
    content: note.content,
    tags: note.tags || [],
    isPinned: Boolean(note.isPinned),
    isFavorite: Boolean(note.isFavorite),
  };
}

export async function getNoteConflict(userId, noteId) {
  return getConflictForNote(userId, noteId);
}

export async function keepServerVersion(userId, conflict) {
  if (!conflict?.serverNote)
    throw new Error("The server version is unavailable");
  await upsertLocalNoteForUser(userId, conflict.serverNote);
  await deleteOperation(conflict.operationId);
  await updateConflict({
    ...conflict,
    status: "resolved",
    resolution: "keep-server",
    resolvedAt: new Date().toISOString(),
  });
  requestSync(userId);
  window.dispatchEvent(
    new CustomEvent("hyeboard:local-change", {
      detail: { userId, noteId: conflict.noteId },
    }),
  );
}

export async function keepLocalVersion(userId, conflict) {
  const localNote = await getLocalNoteForUser(userId, conflict.noteId);
  const serverNote = conflict?.serverNote;
  if (!localNote || !serverNote)
    throw new Error("The local or server version is unavailable");

  await deleteOperation(conflict.operationId);
  const rebasedNote = {
    ...localNote,
    revision: Number(serverNote.revision || 1),
    localOnly: true,
    localUpdatedAt: new Date().toISOString(),
  };
  await upsertLocalNoteForUser(userId, rebasedNote);
  const operation = await enqueueOperation(userId, {
    operationId: newOperationId(),
    type: "UPDATE_NOTE",
    noteId: conflict.noteId,
    baseRevision: Number(serverNote.revision || 1),
    coalesceKey: `update:${conflict.noteId}`,
    payload: updatePayload(rebasedNote),
  });
  await updateConflict({
    ...conflict,
    status: "resolved",
    resolution: "keep-local",
    resolvedAt: new Date().toISOString(),
    rebasedOperationId: operation.operationId,
  });
  requestSync(userId);
}
