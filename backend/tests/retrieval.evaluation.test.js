import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRetrieval, rankNotes } from "../src/services/retrievalService.js";

const notes = [
  { id: "react", title: "React Hooks", tags: ["react", "frontend"], content: "useEffect dependencies and custom hooks" },
  { id: "roadmap", title: "Frontend Roadmap", tags: ["planning"], content: "Ship the React dashboard after accessibility review" },
  { id: "database", title: "MongoDB Notes", tags: ["backend"], content: "Indexes and query planning" },
  { id: "cooking", title: "Weekend Cooking", tags: ["personal"], content: "Roast vegetables and sourdough" },
  { id: "deleted-react", title: "Old React Draft", tags: ["react"], content: "Old hooks draft", deletedAt: "2026-01-01T00:00:00.000Z" },
];

const dataset = {
  notes,
  queries: [
    { id: "exact-title", question: "React Hooks", expectedIds: ["react"] },
    { id: "tag-topic", question: "frontend planning", expectedIds: ["react", "roadmap"] },
    { id: "unrelated", question: "sourdough", expectedIds: ["cooking"] },
    { id: "missing", question: "quantum physics", expectedIds: [] },
  ],
};

test("lexical retrieval excludes deleted notes and ranks exact title matches", () => {
  const ranked = rankNotes(notes, "React Hooks", 3).map(({ note }) => note.id);
  assert.equal(ranked[0], "react");
  assert.equal(ranked.includes("deleted-react"), false);
});

test("retrieval evaluation reports deterministic baseline metrics", () => {
  const report = evaluateRetrieval(dataset, 3);
  assert.equal(report.deletedLeaks, 0);
  assert.equal(report.results.length, 4);
  assert.equal(report.results.find((result) => result.id === "exact-title").hit, true);
  assert.equal(report.results.find((result) => result.id === "missing").hit, false);
  assert.equal(report.precisionAtK >= 0.5, true);
});
