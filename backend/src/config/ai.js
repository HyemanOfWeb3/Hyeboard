export const AI_MAX_NOTE_CHARS = 12_000;
export const AI_TIMEOUT_MS = 15_000;
export const AI_CACHE_TTL_MS = 5 * 60 * 1_000;
export const AI_MAX_RELATED_CANDIDATES = 20;
export const DEFAULT_AI_API_URL =
  "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_AI_MODEL = "openrouter/free";
export const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
export const GEMINI_MODEL = "gemini-3.6-flash";

export function getAIConfig() {
  const provider = String(process.env.AI_PROVIDER || "").toLowerCase();
  const configuredUrl = process.env.AI_API_URL || "";
  const isGemini =
    provider === "gemini" ||
    Boolean(process.env.GEMINI_API_KEY) ||
    configuredUrl.includes("generativelanguage.googleapis.com");
  return {
    apiKey: process.env.AI_API_KEY || process.env.GEMINI_API_KEY || "",
    apiUrl:
      process.env.AI_API_URL ||
      (isGemini ? GEMINI_API_URL : DEFAULT_AI_API_URL),
    model:
      process.env.AI_MODEL ||
      process.env.GEMINI_MODEL ||
      (isGemini ? GEMINI_MODEL : DEFAULT_AI_MODEL),
    provider: isGemini ? "gemini" : "openrouter",
    siteUrl: process.env.AI_SITE_URL || "https://hyeboard.vercel.app",
    siteName: process.env.AI_SITE_NAME || "HyeBoard",
    timeoutMs: Math.min(
      Number(process.env.AI_TIMEOUT_MS || AI_TIMEOUT_MS),
      AI_TIMEOUT_MS,
    ),
  };
}
