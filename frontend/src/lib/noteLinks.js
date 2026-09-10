export function getNoteReference(note) {
  return note?.clientNoteId || note?._id || note?.id || "";
}

export function getNoteHref(noteOrReference) {
  const reference =
    typeof noteOrReference === "string"
      ? noteOrReference
      : getNoteReference(noteOrReference);
  return `/note/${encodeURIComponent(reference)}`;
}

export function normalizeNoteTitle(title) {
  return String(title || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function findNoteTitleMatches(notes, query) {
  const normalizedQuery = normalizeNoteTitle(query);
  if (!normalizedQuery) return [];
  return notes
    .filter((note) => !note.deletedAt)
    .filter((note) => normalizeNoteTitle(note.title).includes(normalizedQuery))
    .slice(0, 8);
}

export function createInternalMarkdownLink(note, label = note?.title) {
  return `[${label || "Untitled note"}](${getNoteHref(note)})`;
}

export function parseInternalLinks(content = "") {
  const links = [];
  const pattern = /\[([^\]]+)\]\(\/note\/([^)]+)\)/g;
  let match;
  while ((match = pattern.exec(content))) {
    links.push({
      label: match[1],
      reference: decodeURIComponent(match[2]),
      start: match.index,
      end: pattern.lastIndex,
    });
  }
  return links;
}

export function getNoteIdentityValues(note) {
  return [note?._id, note?.id, note?.clientNoteId].filter(Boolean);
}

function resolveNoteReferences(notes, references) {
  const referenceSet = new Set(references);
  const matches = new Map();
  notes.forEach((note) => {
    if (!note || note.deletedAt) return;
    if (
      getNoteIdentityValues(note).some((reference) =>
        referenceSet.has(reference),
      )
    ) {
      matches.set(getNoteReference(note), note);
    }
  });
  return Array.from(matches.values());
}

export function deriveOutgoingLinks(notes = [], sourceNote) {
  if (!sourceNote) return [];
  const links = parseInternalLinks(sourceNote.content);
  const resolved = resolveNoteReferences(
    notes,
    links.map((link) => link.reference),
  );
  const resolvedByReference = new Map();
  resolved.forEach((note) => {
    getNoteIdentityValues(note).forEach((reference) =>
      resolvedByReference.set(reference, note),
    );
  });
  const unique = new Map();
  links.forEach((link) => {
    const target = resolvedByReference.get(link.reference);
    if (target) unique.set(getNoteReference(target), target);
  });
  return Array.from(unique.values()).sort((left, right) =>
    String(left.title || "").localeCompare(String(right.title || "")),
  );
}

export function deriveBacklinks(notes = [], targetNote) {
  const targetReferences = new Set(getNoteIdentityValues(targetNote));
  if (!targetReferences.size) return [];

  const backlinks = new Map();
  notes.forEach((sourceNote) => {
    if (!sourceNote || sourceNote.deletedAt) return;
    const sourceReferences = getNoteIdentityValues(sourceNote);
    if (sourceReferences.some((reference) => targetReferences.has(reference)))
      return;
    const links = parseInternalLinks(sourceNote.content);
    const pointsToTarget = links.some((link) =>
      targetReferences.has(link.reference),
    );
    if (!pointsToTarget) return;
    const sourceIdentity = sourceReferences[0];
    if (sourceIdentity) backlinks.set(sourceIdentity, sourceNote);
  });

  return Array.from(backlinks.values()).sort((left, right) =>
    String(left.title || "").localeCompare(String(right.title || "")),
  );
}

export function deriveRelatedNotes(notes = [], targetNote) {
  if (!targetNote) return [];
  const targetReferences = new Set(getNoteIdentityValues(targetNote));
  const outgoing = new Set(
    deriveOutgoingLinks(notes, targetNote).map(getNoteReference),
  );
  const backlinks = new Set(
    deriveBacklinks(notes, targetNote).map(getNoteReference),
  );
  const targetTags = new Set(
    (targetNote.tags || [])
      .map((tag) => String(tag).trim().toLowerCase())
      .filter(Boolean),
  );
  if (!targetTags.size) return [];

  return notes
    .filter((note) => note && !note.deletedAt)
    .filter(
      (note) =>
        !getNoteIdentityValues(note).some((reference) =>
          targetReferences.has(reference),
        ),
    )
    .filter(
      (note) =>
        !outgoing.has(getNoteReference(note)) &&
        !backlinks.has(getNoteReference(note)),
    )
    .filter((note) =>
      (note.tags || []).some((tag) =>
        targetTags.has(String(tag).trim().toLowerCase()),
      ),
    )
    .sort((left, right) =>
      String(left.title || "").localeCompare(String(right.title || "")),
    );
}

export function deriveOrphanNotes(notes = []) {
  const activeNotes = notes.filter((note) => note && !note.deletedAt);
  const graph = deriveNoteGraph(activeNotes);
  const connectedIds = new Set();
  graph.edges.forEach((edge) => {
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
  });
  return activeNotes.filter(
    (note) => !connectedIds.has(getNoteReference(note)),
  );
}

export function deriveNoteGraph(notes = [], options = {}) {
  const activeNotes = notes.filter((note) => note && !note.deletedAt);
  const noteByReference = new Map();
  activeNotes.forEach((note) => {
    getNoteIdentityValues(note).forEach((reference) => {
      noteByReference.set(reference, note);
    });
  });

  const edgeMap = new Map();
  activeNotes.forEach((sourceNote) => {
    const sourceId = getNoteReference(sourceNote);
    if (!sourceId) return;
    parseInternalLinks(sourceNote.content).forEach((link) => {
      const targetNote = noteByReference.get(link.reference);
      const targetId = targetNote && getNoteReference(targetNote);
      if (!targetId || sourceId === targetId) return;
      const edgeId = `${sourceId}->${targetId}`;
      const existing = edgeMap.get(edgeId);
      edgeMap.set(edgeId, {
        id: edgeId,
        source: sourceId,
        target: targetId,
        count: (existing?.count || 0) + 1,
      });
    });
  });

  let edges = Array.from(edgeMap.values());
  let visibleNotes = activeNotes;
  const centerId = options.centerId;
  if (centerId) {
    const depth = Math.max(1, Number(options.depth || 1));
    const distances = new Map([[centerId, 0]]);
    const adjacency = new Map();
    edges.forEach((edge) => {
      adjacency.set(edge.source, [
        ...(adjacency.get(edge.source) || []),
        edge.target,
      ]);
      adjacency.set(edge.target, [
        ...(adjacency.get(edge.target) || []),
        edge.source,
      ]);
    });
    const queue = [centerId];
    while (queue.length) {
      const current = queue.shift();
      const currentDistance = distances.get(current);
      if (currentDistance >= depth) continue;
      (adjacency.get(current) || []).forEach((neighbor) => {
        if (!distances.has(neighbor)) {
          distances.set(neighbor, currentDistance + 1);
          queue.push(neighbor);
        }
      });
    }
    const visibleIds = new Set(distances.keys());
    visibleNotes = activeNotes.filter((note) =>
      visibleIds.has(getNoteReference(note)),
    );
    edges = edges.filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
    );
  }

  const limitedNotes = visibleNotes.slice(0, options.maxNodes || 120);
  const limitedIds = new Set(limitedNotes.map(getNoteReference));
  edges = edges.filter(
    (edge) => limitedIds.has(edge.source) && limitedIds.has(edge.target),
  );
  const outgoing = new Map();
  const incoming = new Map();
  edges.forEach((edge) => {
    outgoing.set(edge.source, (outgoing.get(edge.source) || 0) + 1);
    incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
  });

  return {
    nodes: limitedNotes.map((note, index) => ({
      id: getNoteReference(note),
      title: note.title || "Untitled note",
      note,
      outgoingCount: outgoing.get(getNoteReference(note)) || 0,
      backlinkCount: incoming.get(getNoteReference(note)) || 0,
      index,
    })),
    edges,
    truncated: visibleNotes.length > limitedNotes.length,
  };
}
