import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import notesRoutes from "../backend/src/routes/notesRoutes.js";
import { connectDB } from "../backend/src/config/db.js";
import rateLimiter from "../backend/src/middleware/rateLimiter.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS configuration - update with your frontend URL
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  })
);

app.use(express.json());
app.use(rateLimiter);

app.use("/notes", notesRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Serve static files from frontend dist
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// Catch-all route for SPA - serve index.html for all non-API routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

// Initialize database connection
connectDB().catch((err) => {
  console.error("Database connection error:", err);
});

export default app;
