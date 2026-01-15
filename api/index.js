import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import notesRoutes from "../backend/src/routes/notesRoutes.js";
import { connectDB } from "../backend/src/config/db.js";
import rateLimiter from "../backend/src/middleware/rateLimiter.js";

dotenv.config();

const app = express();

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

// Initialize database connection
connectDB().catch((err) => {
  console.error("Database connection error:", err);
});

export default app;
