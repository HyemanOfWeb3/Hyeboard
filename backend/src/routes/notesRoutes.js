import express from "express";
import {
  getAllNotes,
  createNote,
  updateNote,
  deleteNote,
  getSelectionById,
  getTrash,
  restoreNote,
  permanentlyDeleteNote,
  emptyTrash,
  getNoteVersions,
  restoreNoteVersion,
} from "../controllers/notesController.js";
import ratelimit from "../config/upstash.js";
import { requireAuth } from "../middleware/auth.js";
import { requireNoteAccess } from "../services/collaborationService.js";

const router = express.Router();

// Rate limit middleware: 5 requests per 10 seconds per IP
const rateLimitMiddleware = async (req, res, next) => {
  try {
    const identifier = req.ip || req.connection.remoteAddress || "unknown";
    const { success } = await ratelimit.limit(identifier);

    if (!success) {
      return res
        .status(429)
        .json({ message: "Too many requests. Please try again later." });
    }

    next();
  } catch (error) {
    console.error("Rate limiter error:", error);
    // Allow request if rate limiter fails (don't break the app)
    next();
  }
};

// Apply rate limiter to all routes
router.use(rateLimitMiddleware);
router.use(requireAuth);

router.get("/", getAllNotes);
router.get("/trash", getTrash);
router.delete("/trash", emptyTrash);
router.get("/:id/versions", getNoteVersions);
router.post("/:id/versions/:versionId/restore", restoreNoteVersion);
router.get("/:id", getSelectionById);
router.post("/", createNote);
router.put("/:id", requireNoteAccess({ param: "id", edit: true }), updateNote);
router.delete(
  "/:id",
  requireNoteAccess({ param: "id", manage: true }),
  deleteNote,
);
router.post(
  "/:id/restore",
  requireNoteAccess({ param: "id", edit: true, includeDeleted: true }),
  restoreNote,
);
router.delete(
  "/:id/permanent",
  requireNoteAccess({ param: "id", manage: true, includeDeleted: true }),
  permanentlyDeleteNote,
);

export default router;
