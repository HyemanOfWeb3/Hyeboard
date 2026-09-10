let testGenerator = null;

export function setGeminiTestGenerator(generator) {
  testGenerator = generator;
}

function buildSchemas(Type) {
  return {
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
      properties: {
        keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
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
            properties: {
              candidateId: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ["candidateId", "reason"],
          },
        },
      },
      required: ["suggestions"],
    },
    cleanUp: {
      type: Type.OBJECT,
      properties: { content: { type: Type.STRING } },
      required: ["content"],
    },
    checklist: {
      type: Type.OBJECT,
      properties: { items: { type: Type.ARRAY, items: { type: Type.STRING } } },
      required: ["items"],
    },
    titleTags: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["title", "tags"],
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
}

function classifyGeminiError(error) {
  const rawMessage = String(error?.message || "");
  let providerPayload = null;
  try {
    providerPayload = JSON.parse(rawMessage);
  } catch {
    providerPayload = null;
  }
  const status = Number(
    error?.status ||
      error?.statusCode ||
      error?.response?.status ||
      providerPayload?.error?.code ||
      0,
  );
  const providerMessage = String(
    providerPayload?.error?.message || rawMessage,
  )
    .replace(/AIza[0-9A-Za-z_-]+/g, "[REDACTED]")
    .replace(/AQ\.[^\s]+/g, "[REDACTED]")
    .slice(0, 500);
  console.error("Gemini provider request failed", { status, providerMessage });
  if (status === 429)
    return Object.assign(new Error("AI provider rate limit"), {
      code: "AI_RATE_LIMIT",
    });
  if (status === 401 || status === 403)
    return Object.assign(new Error("AI provider authentication failed"), {
      code: "AI_PROVIDER_AUTH",
    });
  if (status >= 400 && status < 500)
    if (status === 404)
      return Object.assign(new Error("AI model is not available"), {
        code: "AI_MODEL_NOT_FOUND",
      });
  if (status >= 400 && status < 500)
    return Object.assign(new Error("AI provider request rejected"), {
      code: "AI_PROVIDER_REQUEST",
    });
  return Object.assign(new Error("AI provider unavailable"), {
    code: "AI_PROVIDER_ERROR",
  });
}

export async function generateGeminiJson({
  apiKey,
  model,
  kind,
  systemInstruction,
  userContent,
  timeoutMs,
}) {
  if (testGenerator)
    return testGenerator({
      apiKey,
      model,
      kind,
      systemInstruction,
      userContent,
    });
  const { GoogleGenAI, Type } = await import("@google/genai");
  const schema = buildSchemas(Type)[kind];
  const ai = new GoogleGenAI({ apiKey });
  const request = ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    config: {
      systemInstruction,
      temperature: kind === "assistant" ? 0.1 : 0.2,
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });
  try {
    const response = await Promise.race([
      request,
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              Object.assign(new Error("AI provider timed out"), {
                code: "AI_TIMEOUT",
              }),
            ),
          timeoutMs,
        ),
      ),
    ]);
    if (!response?.text)
      throw Object.assign(new Error("AI provider returned no content"), {
        code: "AI_PROVIDER_ERROR",
      });
    return response.text;
  } catch (error) {
    if (error.code) throw error;
    throw classifyGeminiError(error);
  }
}
