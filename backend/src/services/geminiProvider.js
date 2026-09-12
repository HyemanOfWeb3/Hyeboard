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

function classifyGeminiError(error, sensitiveValues = []) {
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
  const providerErrorCode = String(
    providerPayload?.error?.status || providerPayload?.error?.code || "UNKNOWN",
  ).slice(0, 80);
  let providerMessage = String(
    providerPayload?.error?.message || rawMessage,
  );
  for (const sensitiveValue of sensitiveValues) {
    if (sensitiveValue)
      providerMessage = providerMessage.replaceAll(
        String(sensitiveValue),
        "[REDACTED]",
      );
  }
  providerMessage = providerMessage
    .replace(/AIza[0-9A-Za-z_-]+/g, "[REDACTED]")
    .replace(/AQ\.[^\s]+/g, "[REDACTED]")
    .slice(0, 500);
  const category =
    status === 404
      ? "model_not_found"
      : status === 429
        ? "rate_limit"
        : status === 401 || status === 403
          ? "authentication"
          : status >= 400 && status < 500
            ? "request"
            : "unavailable";
  const details = { status, providerErrorCode, category, providerMessage };
  console.error("Gemini provider request failed", details);
  if (status === 429)
    return Object.assign(new Error("AI provider rate limit"), {
      code: "AI_RATE_LIMIT",
      providerDetails: details,
    });
  if (status === 401 || status === 403)
    return Object.assign(new Error("AI provider authentication failed"), {
      code: "AI_PROVIDER_AUTH",
      providerDetails: details,
    });
  if (status >= 400 && status < 500)
    if (status === 404)
      return Object.assign(new Error("AI model is not available"), {
        code: "AI_MODEL_NOT_FOUND",
        providerDetails: details,
      });
  if (status >= 400 && status < 500)
    return Object.assign(new Error("AI provider request rejected"), {
      code: "AI_PROVIDER_REQUEST",
      providerDetails: details,
    });
  return Object.assign(new Error("AI provider unavailable"), {
    code: "AI_PROVIDER_ERROR",
    providerDetails: details,
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
  const startedAt = Date.now();
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
    if (error.code) {
      console.error("Gemini operation failed", {
        operation: kind,
        model,
        latencyMs: Date.now() - startedAt,
        retryCount: 0,
        category: error.code === "AI_TIMEOUT" ? "timeout" : "integration",
        providerErrorCode: "INTERNAL",
      });
      throw error;
    }
    const classified = classifyGeminiError(error, [userContent, systemInstruction]);
    console.error("Gemini operation failed", {
      operation: kind,
      model,
      latencyMs: Date.now() - startedAt,
      retryCount: 0,
      ...(classified.providerDetails || {}),
    });
    throw classified;
  }
}
