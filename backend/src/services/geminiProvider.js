import { GoogleGenAI, Type } from "@google/genai";

let testGenerator = null;

export function setGeminiTestGenerator(generator) {
  testGenerator = generator;
}

const schemas = {
  summarize: {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["summary", "keyPoints"],
  },
  keyPoints: {
    type: Type.OBJECT,
    properties: { keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } } },
    required: ["keyPoints"],
  },
  suggestTags: {
    type: Type.OBJECT,
    properties: { tags: { type: Type.ARRAY, items: { type: Type.STRING } } },
    required: ["tags"],
  },
  related: {
    type: Type.OBJECT,
    properties: {
      suggestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { candidateId: { type: Type.STRING }, reason: { type: Type.STRING } },
          required: ["candidateId", "reason"],
        },
      },
    },
    required: ["suggestions"],
  },
  assistant: {
    type: Type.OBJECT,
    properties: {
      answer: { type: Type.STRING },
      sourceKeys: { type: Type.ARRAY, items: { type: Type.STRING } },
      uncertainty: { type: Type.STRING },
    },
    required: ["answer", "sourceKeys", "uncertainty"],
  },
};

function classifyGeminiError(error) {
  const status = Number(error?.status || error?.statusCode || error?.code || 0);
  if (status === 429) return Object.assign(new Error("AI provider rate limit"), { code: "AI_RATE_LIMIT" });
  if (status === 401 || status === 403) return Object.assign(new Error("AI provider authentication failed"), { code: "AI_PROVIDER_AUTH" });
  if (status >= 400 && status < 500) return Object.assign(new Error("AI provider request rejected"), { code: "AI_PROVIDER_REQUEST" });
  return Object.assign(new Error("AI provider unavailable"), { code: "AI_PROVIDER_ERROR" });
}

export async function generateGeminiJson({ apiKey, model, kind, systemInstruction, userContent, timeoutMs }) {
  if (testGenerator) return testGenerator({ apiKey, model, kind, systemInstruction, userContent });
  const ai = new GoogleGenAI({ apiKey });
  const request = ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    config: {
      systemInstruction,
      temperature: kind === "assistant" ? 0.1 : 0.2,
      responseMimeType: "application/json",
      responseSchema: schemas[kind],
    },
  });
  try {
    const response = await Promise.race([
      request,
      new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error("AI provider timed out"), { code: "AI_TIMEOUT" })), timeoutMs)),
    ]);
    if (!response?.text) throw Object.assign(new Error("AI provider returned no content"), { code: "AI_PROVIDER_ERROR" });
    return response.text;
  } catch (error) {
    if (error.code) throw error;
    throw classifyGeminiError(error);
  }
}
