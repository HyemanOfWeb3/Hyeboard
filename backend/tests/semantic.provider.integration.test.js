import assert from "node:assert/strict";
import test from "node:test";
import { GoogleGenAI } from "@google/genai";

const enabled = process.env.SEMANTIC_INTEGRATION === "true" && Boolean(process.env.GEMINI_API_KEY || process.env.AI_API_KEY);
const options = { skip: !enabled ? "Set SEMANTIC_INTEGRATION=true with a disposable restricted Gemini key" : false };
const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";

function cosine(left, right) {
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
  const leftNorm = Math.sqrt(left.reduce((sum, value) => sum + value * value, 0));
  const rightNorm = Math.sqrt(right.reduce((sum, value) => sum + value * value, 0));
  return leftNorm && rightNorm ? dot / (leftNorm * rightNorm) : 0;
}

test("disposable Gemini embedding smoke test returns vectors", options, async () => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.AI_API_KEY });
  const response = await ai.models.embedContent({ model, contents: "A note about offline synchronization" });
  const values = response.embeddings?.[0]?.values;
  assert.ok(Array.isArray(values));
  assert.ok(values.length > 0);
  assert.equal(cosine(values, values), 1);
});
