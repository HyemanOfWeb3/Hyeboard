const DB_NAME = "hyeboard-db";
const STORE_NAME = "notes-by-user";
const ACTIVE_USER_KEY = "hyeboard:active-user";

function isIndexedDBAvailable() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function normalizeUserId(userId) {
  return String(userId ?? "").trim();
}

function userScopeKey(userId) {
  return `user:${normalizeUserId(userId)}`;
}

function normalizeLocalNote(note, userId) {
  const hydratedDate = new Date().toISOString();
  const id = note?._id || note?.id || `${userId}:${hydratedDate}`;
  const tags = Array.isArray(note?.tags) ? note.tags : [];

  return {
    _id: id,
    id,
    userId: normalizeUserId(userId),
    title: typeof note?.title === "string" ? note.title : "",
    content: typeof note?.content === "string" ? note.content : "",
    tags: tags.map((tag) => String(tag).trim()).filter(Boolean),
    isPinned: Boolean(note?.isPinned),
    isFavorite: Boolean(note?.isFavorite),
    deletedAt: note?.deletedAt ?? null,
    createdAt: note?.createdAt || hydratedDate,
    updatedAt: note?.updatedAt || hydratedDate,
    localUpdatedAt: note?.localUpdatedAt || hydratedDate,
    localOnly: Boolean(note?.localOnly),
    syncedAt: note?.syncedAt ?? null,
    revision: Number(note?.revision || 0),
    clientNoteId: note?.clientNoteId || null,
  };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error("IndexedDB is unavailable in this browser"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, 2);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "scopeKey" });
      }
      if (!database.objectStoreNames.contains("operations")) {
        const operations = database.createObjectStore("operations", {
          keyPath: "operationId",
        });
        operations.createIndex("userId", "userId", { unique: false });
        operations.createIndex("userStatus", ["userId", "status"], {
          unique: false,
        });
      }
      if (!database.objectStoreNames.contains("syncMeta")) {
        database.createObjectStore("syncMeta", { keyPath: "userId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error || new Error("Could not open the local notes database"),
      );
  });
}

async function readScope(userId) {
  if (!userId || !isIndexedDBAvailable()) {
    return { notes: [], trash: [] };
  }

  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(userScopeKey(userId));

    request.onsuccess = () => {
      const record = request.result || { notes: [], trash: [] };
      resolve({
        notes: Array.isArray(record.notes) ? record.notes : [],
        trash: Array.isArray(record.trash) ? record.trash : [],
      });
    };

    request.onerror = () =>
      reject(request.error || new Error("Could not read local notes"));
  });
}

async function writeScope(userId, nextState) {
  if (!userId || !isIndexedDBAvailable()) {
    return;
  }

  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const payload = {
      scopeKey: userScopeKey(userId),
      userId: normalizeUserId(userId),
      notes: Array.isArray(nextState.notes) ? nextState.notes : [],
      trash: Array.isArray(nextState.trash) ? nextState.trash : [],
      updatedAt: new Date().toISOString(),
    };

    const request = store.put(payload);
    request.onsuccess = () => resolve(payload);
    request.onerror = () =>
      reject(request.error || new Error("Could not write local notes"));
  });
}

export function mergeServerWithLocal(localNotes = [], serverNotes = []) {
  const byId = new Map();

  serverNotes.forEach((note) => {
    byId.set(note._id || note.id, note);
  });

  localNotes.forEach((localNote) => {
    const id = localNote._id || localNote.id;
    const existing = byId.get(id);

    if (!existing) {
      byId.set(id, localNote);
      return;
    }

    const localTime = new Date(
      localNote.localUpdatedAt || localNote.updatedAt || 0,
    ).getTime();
    const serverTime = new Date(
      existing.updatedAt || existing.createdAt || 0,
    ).getTime();

    if (localTime > serverTime) {
      byId.set(id, {
        ...existing,
        ...localNote,
        _id: existing._id || localNote._id || id,
        updatedAt: existing.updatedAt || localNote.updatedAt,
        localUpdatedAt: localNote.localUpdatedAt || localNote.updatedAt,
      });
    }
  });

  return Array.from(byId.values()).filter(Boolean);
}

export async function getLocalNotesForUser(userId) {
  return readScope(userId);
}

export async function persistLocalNotesForUser(userId, notes = [], trash = []) {
  const nextNotes = (Array.isArray(notes) ? notes : []).map((note) =>
    normalizeLocalNote(note, userId),
  );
  const nextTrash = (Array.isArray(trash) ? trash : []).map((note) =>
    normalizeLocalNote(note, userId),
  );
  await writeScope(userId, { notes: nextNotes, trash: nextTrash });
  return { notes: nextNotes, trash: nextTrash };
}

export async function upsertLocalNoteForUser(userId, note) {
  const scope = await readScope(userId);
  const normalized = normalizeLocalNote(note, userId);
  const noteId = normalized._id;

  const currentNotes = (scope.notes || []).filter(
    (item) => (item._id || item.id) !== noteId,
  );
  const currentTrash = (scope.trash || []).filter(
    (item) => (item._id || item.id) !== noteId,
  );

  const nextNotes = normalized.deletedAt
    ? currentNotes
    : [...currentNotes, normalized];
  const nextTrash = normalized.deletedAt
    ? [...currentTrash, normalized]
    : currentTrash;

  await writeScope(userId, { notes: nextNotes, trash: nextTrash });
  return { notes: nextNotes, trash: nextTrash };
}

export async function clearLocalNotesForUser(userId) {
  if (!userId || !isIndexedDBAvailable()) {
    return;
  }

  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(userScopeKey(userId));
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error || new Error("Could not clear local user notes"));
  });
}

function createOperationId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueOperation(userId, operation) {
  if (!userId || !isIndexedDBAvailable()) return null;
  const database = await openDatabase();
  const operationId = operation.operationId || createOperationId();
  const now = new Date().toISOString();
  const record = {
    ...operation,
    operationId,
    userId: normalizeUserId(userId),
    status: operation.status || "pending",
    attempts: operation.attempts || 0,
    createdAt: operation.createdAt || now,
    nextAttemptAt: operation.nextAttemptAt || now,
    lastError: operation.lastError || null,
  };

  if (record.coalesceKey) {
    const readTransaction = database.transaction("operations", "readonly");
    const operations = await requestResult(
      readTransaction.objectStore("operations").getAll(),
    );
    const existing = operations.find(
      (item) =>
        item.userId === record.userId &&
        item.coalesceKey === record.coalesceKey &&
        item.status === "pending",
    );
    if (existing) {
      record.operationId = existing.operationId;
      record.createdAt = existing.createdAt;
    }
  }
  const writeTransaction = database.transaction("operations", "readwrite");
  await requestResult(writeTransaction.objectStore("operations").put(record));
  window.dispatchEvent(
    new CustomEvent("hyeboard:local-change", {
      detail: { userId: record.userId, operationId: record.operationId },
    }),
  );
  return record;
}

export async function getOperationsForUser(userId) {
  if (!userId || !isIndexedDBAvailable()) return [];
  const database = await openDatabase();
  const transaction = database.transaction("operations", "readonly");
  const operations = await requestResult(
    transaction.objectStore("operations").index("userId").getAll(normalizeUserId(userId)),
  );
  return operations.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function updateOperation(operation) {
  if (!operation?.operationId || !isIndexedDBAvailable()) return operation;
  const database = await openDatabase();
  const transaction = database.transaction("operations", "readwrite");
  await requestResult(transaction.objectStore("operations").put(operation));
  return operation;
}

export async function deleteOperation(operationId) {
  if (!operationId || !isIndexedDBAvailable()) return;
  const database = await openDatabase();
  const transaction = database.transaction("operations", "readwrite");
  await requestResult(transaction.objectStore("operations").delete(operationId));
}

export async function setSyncMeta(userId, metadata) {
  if (!userId || !isIndexedDBAvailable()) return;
  const database = await openDatabase();
  const transaction = database.transaction("syncMeta", "readwrite");
  await requestResult(
    transaction.objectStore("syncMeta").put({ userId: normalizeUserId(userId), ...metadata }),
  );
}

export async function getSyncMeta(userId) {
  if (!userId || !isIndexedDBAvailable()) return null;
  const database = await openDatabase();
  const transaction = database.transaction("syncMeta", "readonly");
  return requestResult(transaction.objectStore("syncMeta").get(normalizeUserId(userId)));
}

export async function replaceLocalNoteIdForUser(userId, localId, serverNote) {
  if (!userId || !localId || !serverNote) return;
  const scope = await readScope(userId);
  const replace = (items) =>
    items.map((item) =>
      (item._id || item.id) === localId
        ? { ...serverNote, localOnly: false, syncedAt: new Date().toISOString() }
        : item,
    );
  await writeScope(userId, {
    notes: replace(scope.notes),
    trash: replace(scope.trash),
  });

  const operations = await getOperationsForUser(userId);
  await Promise.all(
    operations
      .filter((operation) => operation.noteId === localId)
      .map((operation) =>
        updateOperation({
          ...operation,
          noteId: serverNote._id,
          baseRevision:
            operation.type === "CREATE_NOTE"
              ? operation.baseRevision
              : Number(serverNote.revision || 1),
          payload: { ...operation.payload, noteId: serverNote._id },
        }),
      ),
  );
}

export function getStoredUserId() {
  try {
    return localStorage.getItem(ACTIVE_USER_KEY);
  } catch {
    return null;
  }
}

export function setStoredUserId(userId) {
  try {
    if (userId) {
      localStorage.setItem(ACTIVE_USER_KEY, String(userId));
      return;
    }
    localStorage.removeItem(ACTIVE_USER_KEY);
  } catch {
    // Ignore storage errors so user auth flow continues.
  }
}

export function clearStoredUserId() {
  try {
    localStorage.removeItem(ACTIVE_USER_KEY);
  } catch {
    // Ignore storage errors so logout continues.
  }
}
