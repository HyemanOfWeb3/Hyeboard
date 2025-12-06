import express from "express";
import {
    getAllNotes,
    createNote,
    updateNote,
    deleteNote,
    getSelectionById,
} from "../controllers/notesController.js";
import ratelimit from "../config/upstash.js";

const router = express.Router();

// Rate limit middleware: 5 requests per 10 seconds per IP
const rateLimitMiddleware = async (req, res, next) => {
    try {
        const identifier = req.ip || req.connection.remoteAddress || "unknown";
        const { success } = await ratelimit.limit(req.ip);

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

router.get("/", getAllNotes);
router.get("/:id", getSelectionById);
router.post("/", createNote);
router.put("/:id", updateNote);
router.delete("/:id", deleteNote);

export default router;
