import api from "./axios";
import {
  deleteOperation,
  enqueueOperation,
  getLocalNoteForUser,
  getOperationsForUser,
  replaceLocalNoteIdForUser,
  saveConflict,
  setSyncMeta,
  updateOperation,
  upsertLocalNoteForUser,
} from "./localNotesStore";

const MAX_ATTEMPTS = 8;
const BASE_RETRY_MS = 1500;
let activeUserId = null;
let running = false;
let fallbackLock = false;
let sequence = 0;
let retryTimer = null;
let snapshot = { status: "idle", userId: null, pending: 0, error: null };
const subscribers = new Set();
const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("hyeboard-sync")
    : null;

function acquireFallbackLock(userId) {
  const key = `hyeboard:sync-lock:${userId}`;
  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    const current = JSON.parse(localStorage.getItem(key) || "null");
    if (current?.expiresAt > Date.now()) return null;
    localStorage.setItem(
      key,
      JSON.stringify({ token, expiresAt: Date.now() + 30_000 }),
    );
    return JSON.parse(localStorage.getItem(key) || "null")?.token === token
      ? { key, token }
      : null;
  } catch {
    return null;
  }
}

function releaseFallbackLock(lock) {
  if (!lock) return;
  try {
    const current = JSON.parse(localStorage.getItem(lock.key) || "null");
    if (current?.token === lock.token) localStorage.removeItem(lock.key);
  } catch {
    // A failed lease cleanup expires naturally.
  }
}

function publish(next) {
  snapshot = { ...snapshot, ...next };
  subscribers.forEach((listener) => listener(snapshot));
}

function isRetryable(error) {
  const status = error.response?.status;
  return !status || status === 408 || status === 429 || status >= 500;
}

function retryDelay(attempts) {
  return Math.min(60_000, BASE_RETRY_MS * 2 ** Math.max(0, attempts - 1));
}

function isActive(userId, currentSequence) {
  return activeUserId === userId && sequence === currentSequence;
}

async function request(operation) {
  const data = {
    ...operation.payload,
    operationId: operation.operationId,
    baseRevision: operation.baseRevision,
  };
  if (operation.type === "CREATE_NOTE") {
    return api.post("/notes", data, { skipAuthRedirect: true });
  }
  if (operation.type === "UPDATE_NOTE") {
    return api.put(`/notes/${operation.noteId}`, data, {
      skipAuthRedirect: true,
    });
  }
  if (operation.type === "DELETE_NOTE") {
    return api.delete(`/notes/${operation.noteId}`, {
      data,
      skipAuthRedirect: true,
    });
  }
  if (operation.type === "RESTORE_NOTE") {
    return api.post(`/notes/${operation.noteId}/restore`, data, {
      skipAuthRedirect: true,
    });
  }
  throw new Error(`Unsupported sync operation: ${operation.type}`);
}

async function applySuccessfulOperation(userId, operation, response) {
  const serverNote = response.data;
  if (!serverNote || !serverNote._id)
    throw new Error("Sync response did not include the saved note");
  const noteIds = new Set([operation.noteId, serverNote._id]);
  let pendingForNote = false;
  if (operation.type === "CREATE_NOTE") {
    await replaceLocalNoteIdForUser(userId, operation.noteId, serverNote);
  } else {
    await upsertLocalNoteForUser(userId, serverNote);
    const queued = await getOperationsForUser(userId);
    await Promise.all(
      queued
        .filter(
          (next) =>
            noteIds.has(next.noteId) && next.status === "pending",
        )
        .map((next) =>
          updateOperation({ ...next, baseRevision: serverNote.revision }),
        ),
    );
  }
  await deleteOperation(operation.operationId);
  const remainingForNote = await getOperationsForUser(userId);
  pendingForNote = remainingForNote.some(
    (next) =>
      noteIds.has(next.noteId) &&
      ["pending", "syncing"].includes(next.status),
  );
  await setSyncMeta(userId, { lastSuccessfulSyncAt: new Date().toISOString() });
  const event = {
    type: "notes-changed",
    userId,
    noteId: operation.noteId,
    serverNote,
    pendingForNote,
  };
  channel?.postMessage(event);
  window.dispatchEvent(new CustomEvent("hyeboard:note-synced", { detail: event }));
}

async function processOperation(userId, operation, currentSequence) {
  if (!isActive(userId, currentSequence)) return;
  const syncing = {
    ...operation,
    status: "syncing",
    attempts: operation.attempts + 1,
    lastError: null,
  };
  await updateOperation(syncing);

  try {
    const response = await request(syncing);
    await applySuccessfulOperation(userId, syncing, response);
  } catch (error) {
    const status = error.response?.status;
    if (status === 401) {
      await updateOperation({
        ...syncing,
        status: "auth-required",
        lastError: "Authentication required",
      });
      publish({ status: "auth-required", error: "Authentication required" });
      return;
    }
    if (
      status === 409 &&
      error.response?.data?.code === "SYNC_OPERATION_IN_PROGRESS"
    ) {
      await updateOperation({
        ...syncing,
        status: "pending",
        nextAttemptAt: new Date(
          Date.now() + retryDelay(syncing.attempts),
        ).toISOString(),
        lastError: error.response.data.message,
      });
      publish({ status: "error", error: error.response.data.message });
      return;
    }
    if (status === 409 && error.response?.data?.code === "REVISION_CONFLICT") {
      const localNote = (await getLocalNoteForUser(userId, syncing.noteId)) || {
        _id: syncing.noteId,
        title: syncing.payload?.title || "",
        content: syncing.payload?.content || "",
        tags: syncing.payload?.tags || [],
        isPinned: Boolean(syncing.payload?.isPinned),
        isFavorite: Boolean(syncing.payload?.isFavorite),
        revision: syncing.baseRevision,
      };
      await saveConflict(userId, {
        operationId: syncing.operationId,
        noteId: syncing.noteId,
        localNote,
        serverNote: error.response.data.serverNote || null,
        localRevision: syncing.baseRevision,
        serverRevision: Number(error.response.data.serverNote?.revision || 0),
        operation: syncing,
      });
      await updateOperation({
        ...syncing,
        status: "conflict",
        lastError: error.response.data.message || "The note changed elsewhere",
        serverNote: error.response.data.serverNote || null,
      });
      publish({ status: "conflict", error: "A note needs your attention" });
      return;
    }

    const retry = isRetryable(error) && syncing.attempts < MAX_ATTEMPTS;
    await updateOperation({
      ...syncing,
      status: retry ? "pending" : "failed",
      nextAttemptAt: new Date(
        Date.now() + (retry ? retryDelay(syncing.attempts) : 0),
      ).toISOString(),
      lastError:
        error.response?.data?.message || error.message || "Sync failed",
    });
    publish({
      status: retry ? "error" : "error",
      error: error.message || "Sync failed",
    });
  }
}

async function flushWithoutLock(userId, currentSequence) {
  if (running || !isActive(userId, currentSequence)) return;
  running = true;
  let nextAttemptAt = null;
  try {
    const operations = await getOperationsForUser(userId);
    await Promise.all(
      operations
        .filter((operation) => operation.status === "syncing")
        .map((operation) =>
          updateOperation({
            ...operation,
            status: "pending",
            nextAttemptAt: new Date().toISOString(),
            lastError: "Recovered after an interrupted sync attempt",
          }),
        ),
    );
    const recoveredOperations = operations.map((operation) =>
      operation.status === "syncing"
        ? {
            ...operation,
            status: "pending",
            nextAttemptAt: new Date().toISOString(),
          }
        : operation,
    );
    const ready = recoveredOperations.filter(
      (operation) =>
        operation.status === "pending" &&
        new Date(operation.nextAttemptAt || 0).getTime() <= Date.now(),
    );
    publish({
      status: ready.length ? "syncing" : "synced",
      pending: ready.length,
      error: null,
    });
    for (const operation of ready) {
      if (!isActive(userId, currentSequence)) break;
      await processOperation(userId, operation, currentSequence);
    }
    const remaining = await getOperationsForUser(userId);
    const hasPending = remaining.some((operation) =>
      ["pending", "syncing"].includes(operation.status),
    );
    const hasConflict = remaining.some(
      (operation) => operation.status === "conflict",
    );
    publish({
      status: hasConflict
        ? "conflict"
        : hasPending
          ? remaining.some(
              (operation) =>
                new Date(operation.nextAttemptAt || 0).getTime() > Date.now(),
            )
            ? "retrying"
            : "queued"
          : "synced",
      pending: remaining.filter((operation) => operation.status !== "synced")
        .length,
    });
    const pendingTimes = remaining
      .filter((operation) => ["pending", "syncing"].includes(operation.status))
      .map((operation) => new Date(operation.nextAttemptAt || 0).getTime())
      .filter((time) => Number.isFinite(time));
    if (hasPending && pendingTimes.length)
      nextAttemptAt = Math.min(...pendingTimes);
  } finally {
    running = false;
    if (nextAttemptAt !== null && isActive(userId, currentSequence)) {
      if (retryTimer) window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(
        () => requestSync(userId),
        Math.max(0, nextAttemptAt - Date.now()),
      );
    }
  }
}

async function flushUserQueue(userId) {
  const currentSequence = sequence;
  if (navigator.locks?.request) {
    await navigator.locks.request(
      `hyeboard-sync:${userId}`,
      { ifAvailable: true },
      async (lock) => {
        if (lock) await flushWithoutLock(userId, currentSequence);
      },
    );
    return;
  }
  if (fallbackLock) return;
  const lock = acquireFallbackLock(userId);
  if (!lock) return;
  fallbackLock = true;
  try {
    await flushWithoutLock(userId, currentSequence);
  } finally {
    fallbackLock = false;
    releaseFallbackLock(lock);
  }
}

export function requestSync(userId) {
  const normalized = String(userId || "").trim();
  if (!normalized || normalized !== activeUserId || !navigator.onLine) return;
  void flushUserQueue(normalized);
}

export function startSyncForUser(userId) {
  const normalized = String(userId || "").trim();
  if (!normalized) return;
  activeUserId = normalized;
  sequence += 1;
  publish({
    userId: normalized,
    status: navigator.onLine ? "idle" : "offline",
    error: null,
  });
  requestSync(normalized);
}

export function stopSyncForUser(userId) {
  if (!userId || activeUserId !== String(userId)) return;
  activeUserId = null;
  sequence += 1;
  if (retryTimer) window.clearTimeout(retryTimer);
  retryTimer = null;
  publish({ userId: null, status: "idle", pending: 0, error: null });
}

export function subscribeSync(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

export function getSyncSnapshot() {
  return snapshot;
}

window.addEventListener("online", () => {
  if (activeUserId) {
    publish({ status: "syncing", error: null });
    requestSync(activeUserId);
  }
});
window.addEventListener("offline", () => publish({ status: "offline" }));
window.addEventListener(
  "focus",
  () => activeUserId && requestSync(activeUserId),
);
channel?.addEventListener("message", (event) => {
  if (event.data?.type === "sync-request" && event.data.userId === activeUserId)
    requestSync(activeUserId);
  if (
    event.data?.type === "notes-changed" &&
    event.data.userId === activeUserId
  ) {
    if (event.data.serverNote)
      window.dispatchEvent(
        new CustomEvent("hyeboard:note-synced", { detail: event.data }),
      );
    window.dispatchEvent(
      new CustomEvent("hyeboard:notes-changed", { detail: event.data }),
    );
  }
});

export async function retryFailedOperations(userId) {
  const operations = await getOperationsForUser(userId);
  await Promise.all(
    operations
      .filter((operation) =>
        ["failed", "auth-required"].includes(operation.status),
      )
      .map((operation) =>
        updateOperation({
          ...operation,
          status: "pending",
          nextAttemptAt: new Date().toISOString(),
        }),
      ),
  );
  requestSync(userId);
}

export async function enqueueAndSync(userId, operation) {
  const queued = await enqueueOperation(userId, operation);
  requestSync(userId);
  return queued;
}
