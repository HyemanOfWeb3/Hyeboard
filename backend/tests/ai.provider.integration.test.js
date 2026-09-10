import assert from "node:assert/strict";
import test from "node:test";
import {
  answerKnowledgeQuestion,
  generateNoteInsight,
} from "../src/services/aiService.js";

const enabled =
  process.env.AI_INTEGRATION === "true" && Boolean(process.env.AI_API_KEY);
const options = {
  skip: !enabled
    ? "Set AI_INTEGRATION=true with a disposable restricted AI_API_KEY"
    : false,
};
const note = {
  title: "Release plan",
  tags: ["release"],
  content: "Use a staged rollout and review accessibility before launch.",
};

test("provider integration returns a summary schema", options, async () => {
  const result = await generateNoteInsight({ kind: "summarize", note });
  assert.equal(typeof result.summary, "string");
  assert.ok(Array.isArray(result.keyPoints));
});

test("provider integration returns bounded tags", options, async () => {
  const result = await generateNoteInsight({ kind: "suggestTags", note });
  assert.ok(Array.isArray(result.tags));
  assert.ok(result.tags.length <= 8);
});

test(
  "provider integration returns related schema with bounded candidates",
  options,
  async () => {
    const result = await generateNoteInsight({
      kind: "related",
      note,
      candidates: [
        {
          id: "candidate_0",
          title: "Accessibility",
          tags: ["release"],
          content: "Accessibility review checklist",
        },
      ],
    });
    assert.ok(Array.isArray(result.suggestions));
    assert.ok(
      result.suggestions.every(
        (suggestion) => suggestion.candidateId === "candidate_0",
      ),
    );
  },
);

test(
  "provider integration returns attributed assistant output",
  options,
  async () => {
    const result = await answerKnowledgeQuestion({
      question: "What should happen before launch?",
      sources: [
        {
          id: "source_0",
          title: note.title,
          tags: note.tags,
          excerpt: note.content,
        },
      ],
    });
    assert.equal(typeof result.answer, "string");
    assert.ok(Array.isArray(result.sourceKeys));
    assert.ok(result.sourceKeys.every((key) => key === "source_0"));
  },
);
