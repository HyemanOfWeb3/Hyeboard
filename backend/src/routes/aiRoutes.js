import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { askKnowledge, noteInsight } from "../controllers/aiController.js";

const router = express.Router();
const requestWindows = new Map();
const AI_REQUEST_LIMIT = 5;
const AI_WINDOW_MS = 5 * 60 * 1_000;

function aiRateLimit(req, res, next) {
  const key = req.user?._id?.toString() || req.ip || "unknown";
  const now = Date.now();
  const window = requestWindows.get(key);
  if (!window || now - window.startedAt >= AI_WINDOW_MS) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    return next();
  }
  if (window.count >= AI_REQUEST_LIMIT) {
    return res
      .status(429)
      .json({ message: "AI request limit reached. Please try again later." });
  }
  window.count += 1;
  return next();
}

router.use(requireAuth);
router.use(aiRateLimit);
router.post("/ask", askKnowledge);
router.post("/notes/:noteId/:kind", noteInsight);

export default router;
