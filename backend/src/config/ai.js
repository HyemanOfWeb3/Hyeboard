export const AI_MAX_NOTE_CHARS = 12_000;
export const AI_TIMEOUT_MS = 15_000;
export const AI_CACHE_TTL_MS = 5 * 60 * 1_000;
export const AI_MAX_RELATED_CANDIDATES = 20;
export const DEFAULT_AI_API_URL =
  "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_AI_MODEL = "openrouter/free";
export const GEMINI_MODEL = "gemini-3.6-flash";

export function getAIConfig() {
  const configuredProvider = String(
    process.env.AI_PROVIDER || "",
  ).toLowerCase();
  const isOpenRouter = configuredProvider === "openrouter";
  const model = isOpenRouter
    ? process.env.AI_MODEL || DEFAULT_AI_MODEL
    : process.env.GEMINI_MODEL || GEMINI_MODEL;
  return {
    apiKey: process.env.AI_API_KEY || process.env.GEMINI_API_KEY || "",
    apiUrl: process.env.AI_API_URL || DEFAULT_AI_API_URL,
    model,
    provider: isOpenRouter ? "openrouter" : "gemini",
    siteUrl: process.env.AI_SITE_URL || "https://hyeboard.vercel.app",
    siteName: process.env.AI_SITE_NAME || "HyeBoard",
    timeoutMs: Math.min(
      Number(process.env.AI_TIMEOUT_MS || AI_TIMEOUT_MS),
      AI_TIMEOUT_MS,
    ),
  };
}
