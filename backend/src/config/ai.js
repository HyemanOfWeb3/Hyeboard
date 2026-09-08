export const AI_MAX_NOTE_CHARS = 12_000;
export const AI_TIMEOUT_MS = 15_000;
export const AI_CACHE_TTL_MS = 5 * 60 * 1_000;
export const AI_MAX_RELATED_CANDIDATES = 20;

export function getAIConfig() {
  return {
    apiKey: process.env.AI_API_KEY || "",
    apiUrl: process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions",
    model: process.env.AI_MODEL || "gpt-4o-mini",
    timeoutMs: Math.min(Number(process.env.AI_TIMEOUT_MS || AI_TIMEOUT_MS), AI_TIMEOUT_MS),
  };
}
