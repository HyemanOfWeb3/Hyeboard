import assert from "node:assert/strict";
import test from "node:test";
import { rankNotes } from "../src/services/retrievalService.js";

const notes = [
  { id: "auth", title: "JWT Authentication", tags: ["security", "auth"], content: "Sessions use signed cookies and authenticated requests.", links: ["deployment"] },
  { id: "deployment", title: "Production Deployment", tags: ["vercel", "operations"], content: "Vercel environment variables and serverless deployment checks.", links: ["auth"] },
  { id: "offline", title: "Offline Sync Architecture", tags: ["offline", "sync"], content: "IndexedDB stores pending note mutations until reconnect.", links: ["conflicts"] },
  { id: "conflicts", title: "Conflict Resolution", tags: ["sync", "recovery"], content: "Revision checks preserve local and server versions.", links: ["offline", "history"] },
  { id: "history", title: "Note Version History", tags: ["recovery"], content: "Meaningful saves create immutable recoverable versions.", links: ["conflicts"] },
  { id: "attachments", title: "Attachment Storage", tags: ["files", "s3"], content: "Private object storage holds signed attachment URLs.", links: [] },
  { id: "graph", title: "Knowledge Graph", tags: ["links", "backlinks"], content: "Links and backlinks form navigable note relationships.", links: ["offline", "auth"] },
  { id: "editor", title: "Markdown Editor", tags: ["writing"], content: "The editor uses a textarea with Markdown shortcuts.", links: ["auth"] },
  { id: "metrics", title: "AI Usage Metrics", tags: ["ai", "cost"], content: "Track request latency failures and rate limits.", links: [] },
  { id: "research", title: "Search Research", tags: ["retrieval"], content: "Lexical search works well for exact terminology.", links: ["graph"] },
  { id: "planning", title: "Q4 Product Roadmap", tags: ["planning", "project"], content: "Prioritize reliability and accessibility work.", links: ["deployment"] },
  { id: "personal", title: "Weekend Plans", tags: ["personal"], content: "Walk, read, and prepare meals.", links: [] },
  { id: "database", title: "MongoDB Data Modeling", tags: ["database"], content: "Indexes support ownership and note lookup.", links: ["auth"] },
  { id: "security", title: "Input Security Review", tags: ["security"], content: "Validate MIME types and treat content as untrusted.", links: ["attachments"] },
  { id: "testing", title: "Regression Testing", tags: ["qa"], content: "Run lint builds API tests and mobile checks.", links: ["deployment"] },
  { id: "deleted", title: "Old Offline Draft", tags: ["offline"], content: "Stale draft should never be retrieved.", deletedAt: "2026-01-01T00:00:00.000Z", links: [] },
];

const queries = [
  { id: "exact-auth", category: "exact", question: "JWT authentication", expected: ["auth"] },
  { id: "exact-offline", category: "exact", question: "offline sync", expected: ["offline"] },
  { id: "paraphrase-login", category: "paraphrase", question: "How are user sessions secured?", expected: ["auth"] },
  { id: "paraphrase-files", category: "paraphrase", question: "Where are uploaded files kept?", expected: ["attachments"] },
  { id: "synonym-database", category: "synonym", question: "data persistence", expected: ["database"] },
  { id: "synonym-deployment", category: "synonym", question: "hosting production", expected: ["deployment"] },
  { id: "conceptual-security", category: "conceptual", question: "How do I stop unauthorized people seeing private information?", expected: ["auth", "security"] },
  { id: "conceptual-recovery", category: "conceptual", question: "How do changes avoid being overwritten?", expected: ["conflicts", "history"] },
  { id: "multi-topic", category: "multi-topic", question: "offline conflicts and version recovery", expected: ["offline", "conflicts", "history"] },
  { id: "relationship", category: "relationship", question: "What connects offline work to recovery?", expected: ["offline", "conflicts", "history"] },
  { id: "ambiguous", category: "ambiguous", question: "planning", expected: ["planning"] },
  { id: "missing", category: "no-match", question: "quantum physics", expected: [] },
  { id: "multilingual", category: "multilingual", question: "autenticación de sesiones", expected: ["auth"] },
];

function tokens(question) {
  return String(question).toLowerCase().match(/[a-z0-9][a-z0-9_-]{1,}/g) || [];
}

function lexicalScore(note, queryTokens) {
  const title = note.title.toLowerCase();
  const tags = note.tags.join(" ").toLowerCase();
  const content = note.content.toLowerCase();
  return queryTokens.reduce((sum, token) => sum + (title.includes(token) ? 8 : 0) + (tags.includes(token) ? 5 : 0) + (content.includes(token) ? 1 : 0), 0);
}

function hybridRank(question, limit = 5) {
  const queryTokens = tokens(question);
  return notes.filter((note) => !note.deletedAt).map((note) => {
    const lexical = lexicalScore(note, queryTokens);
    const relationship = note.links.some((id) => queryTokens.some((token) => id.includes(token))) ? 2 : 0;
    return { note, score: lexical + relationship };
  }).filter((item) => item.score > 0).sort((left, right) => right.score - left.score || left.note.id.localeCompare(right.note.id)).slice(0, limit).map((item) => item.note.id);
}

function metrics(retriever, limit) {
  const rows = queries.map((query) => {
    const retrieved = retriever(query.question, limit);
    const relevant = retrieved.filter((id) => query.expected.includes(id));
    const firstRelevant = retrieved.findIndex((id) => query.expected.includes(id));
    return {
      ...query,
      retrieved,
      hit: relevant.length > 0,
      precision: retrieved.length ? relevant.length / retrieved.length : 0,
      recall: query.expected.length ? relevant.length / query.expected.length : 0,
      reciprocalRank: firstRelevant < 0 ? 0 : 1 / (firstRelevant + 1),
      deletedLeak: retrieved.includes("deleted"),
    };
  });
  return {
    rows,
    hitAtK: rows.filter((row) => row.hit).length / rows.length,
    precisionAtK: rows.reduce((sum, row) => sum + row.precision, 0) / rows.length,
    recallAtK: rows.reduce((sum, row) => sum + row.recall, 0) / rows.length,
    mrr: rows.reduce((sum, row) => sum + row.reciprocalRank, 0) / rows.length,
    deletedLeaks: rows.filter((row) => row.deletedLeak).length,
  };
}

function currentLexical(question, limit) {
  return rankNotes(notes, question, limit).map(({ note }) => note.id);
}

test("expanded lexical and test-only hybrid benchmark reports quality by query class", () => {
  const lexical = metrics(currentLexical, 5);
  const hybrid = metrics(hybridRank, 5);
  const byClass = Object.fromEntries([...new Set(queries.map((query) => query.category))].map((category) => [category, {
    lexicalHit: lexical.rows.filter((row) => row.category === category).filter((row) => row.hit).length,
    hybridHit: hybrid.rows.filter((row) => row.category === category).filter((row) => row.hit).length,
    queries: lexical.rows.filter((row) => row.category === category).length,
  }]));
  console.log("expanded-retrieval-benchmark", JSON.stringify({ lexical, hybrid, byClass }));
  assert.equal(lexical.deletedLeaks, 0);
  assert.equal(hybrid.deletedLeaks, 0);
  assert.equal(notes.filter((note) => !note.deletedAt).length, 15);
});
