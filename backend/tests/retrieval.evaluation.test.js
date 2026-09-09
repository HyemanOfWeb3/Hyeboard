import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRetrieval, evaluateRetrievalByClass, rankNotes } from "../src/services/retrievalService.js";

const notes = [
  { id: "react", title: "React Hooks", tags: ["react", "frontend"], content: "useEffect dependencies and custom hooks" },
  { id: "roadmap", title: "Frontend Roadmap", tags: ["planning"], content: "Ship the React dashboard after accessibility review" },
  { id: "database", title: "MongoDB Notes", tags: ["backend"], content: "Indexes and query planning" },
  { id: "cooking", title: "Weekend Cooking", tags: ["personal"], content: "Roast vegetables and sourdough" },
  { id: "deleted-react", title: "Old React Draft", tags: ["react"], content: "Old hooks draft", deletedAt: "2026-01-01T00:00:00.000Z" },
  { id: "security", title: "Web Security", tags: ["security"], content: "Cookies, authorization, and input validation" },
  { id: "travel", title: "Travel Ideas", tags: ["personal"], content: "Weekend train routes and city walks" },
];

const dataset = {
  notes,
  queries: [
    { id: "exact-title", question: "React Hooks", expectedIds: ["react"] },
    { id: "tag-topic", question: "frontend planning", expectedIds: ["react", "roadmap"] },
    { id: "unrelated", question: "sourdough", expectedIds: ["cooking"] },
    { id: "missing", question: "quantum physics", expectedIds: [] },
    { id: "paraphrase", category: "paraphrased", question: "How do I protect a web app?", expectedIds: ["security"] },
    { id: "conceptual", category: "conceptual", question: "prevent unauthorized access", expectedIds: ["security"] },
    { id: "multi-topic", category: "multi-topic", question: "React accessibility rollout", expectedIds: ["roadmap", "react"] },
    { id: "ambiguous", category: "ambiguous", question: "planning", expectedIds: ["roadmap"] },
    { id: "relationship", category: "relationship", question: "React dashboard accessibility", expectedIds: ["roadmap", "react"] },
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
  assert.equal(report.results.length, 9);
  assert.equal(report.results.find((result) => result.id === "exact-title").hit, true);
  assert.equal(report.results.find((result) => result.id === "missing").hit, false);
  assert.equal(report.precisionAtK >= 0.5, true);
});

test("retrieval evaluation reports query-class weaknesses", () => {
  const report = evaluateRetrievalByClass(dataset, 3);
  assert.ok(report.byClass.paraphrased);
  assert.ok(report.byClass.conceptual);
  assert.ok(report.byClass["multi-topic"]);
  assert.ok(report.byClass.relationship);
  console.log("retrieval-baseline", JSON.stringify({ precisionAtK: report.precisionAtK, recallAtK: report.recallAtK, hitRate: report.hitRate, byClass: report.byClass }));
});
