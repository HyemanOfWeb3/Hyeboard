const IGNORED_TOKENS = new Set([
  "about", "after", "also", "does", "from", "have", "into", "that", "this",
  "what", "when", "where", "which", "with", "your",
]);

export function searchTokens(question) {
  return Array.from(new Set(String(question || "").toLowerCase().match(/[a-z0-9][a-z0-9_-]{1,}/g) || []))
    .filter((token) => !IGNORED_TOKENS.has(token))
    .slice(0, 12);
}

export function scoreNote(note, tokens) {
  const title = String(note.title || "").toLowerCase();
  const tags = (note.tags || []).join(" ").toLowerCase();
  const content = String(note.content || "").toLowerCase();
  return tokens.reduce(
    (score, token) => score + (title.includes(token) ? 8 : 0) + (tags.includes(token) ? 5 : 0) + (content.includes(token) ? 1 : 0),
    0,
  );
}

export function rankNotes(notes = [], question, limit = 8) {
  const tokens = searchTokens(question);
  return notes
    .filter((note) => note && !note.deletedAt)
    .map((note) => ({ note, score: scoreNote(note, tokens) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || String(left.note._id || left.note.id).localeCompare(String(right.note._id || right.note.id)))
    .slice(0, limit);
}

export function evaluateRetrieval(dataset, limit = 3) {
  const results = dataset.queries.map((query) => {
    const retrieved = rankNotes(dataset.notes, query.question, limit).map(({ note }) => String(note.id || note._id));
    const expected = new Set(query.expectedIds.map(String));
    const relevantRetrieved = retrieved.filter((id) => expected.has(id));
    const precision = retrieved.length ? relevantRetrieved.length / retrieved.length : 0;
    const recall = expected.size ? relevantRetrieved.length / expected.size : 0;
    return {
      id: query.id,
      retrieved,
      expected: Array.from(expected),
      precision,
      recall,
      hit: relevantRetrieved.length > 0,
      leakedDeleted: retrieved.some((id) => dataset.notes.find((note) => String(note.id || note._id) === id)?.deletedAt),
    };
  });
  return {
    results,
    precisionAtK: results.length ? results.reduce((sum, result) => sum + result.precision, 0) / results.length : 0,
    recallAtK: results.length ? results.reduce((sum, result) => sum + result.recall, 0) / results.length : 0,
    hitRate: results.length ? results.filter((result) => result.hit).length / results.length : 0,
    deletedLeaks: results.filter((result) => result.leakedDeleted).length,
  };
}
