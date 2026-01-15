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

// Serve static files from frontend dist BEFORE middleware
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// Initialize database connection before processing requests
let dbConnected = false;
let dbConnectionError = null;

// Middleware to ensure DB is connected (only for API routes, not static files)
app.use((req, res, next) => {
  // Only check DB for API routes
  if (!req.path.startsWith("/api")) {
    return next();
  }

  // Skip DB connection check for health check
  if (req.path === "/api/health") {
    return next();
  }

  if (!dbConnected) {
    connectDB()
      .then(() => {
        dbConnected = true;
        dbConnectionError = null;
        console.log("Database initialized for request processing");
        next();
      })
      .catch((error) => {
        dbConnectionError = error.message;
        console.error("Failed to connect to database:", error.message);
        res.status(500).json({
          error: "Database connection failed",
          details: error.message,
        });
      });
  } else {
    next();
  }
});

app.use(rateLimiter);

app.use("/api/notes", notesRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    dbConnected: dbConnected,
    dbError: dbConnectionError,
  });
});

// Catch-all route for SPA - serve index.html for all non-API routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

// Initialize database connection (can be called at startup, but will be retried per request if needed)
connectDB().catch((err) => {
  console.warn("Initial database connection attempt failed:", err.message);
  console.log("Will retry connection on first request");
});

export default app;
