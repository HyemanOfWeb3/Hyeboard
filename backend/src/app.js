import express from "express";
import cors from "cors";
import notesRoutes from "./routes/notesRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import { connectDB } from "./config/db.js";
import rateLimiter from "./middleware/rateLimiter.js";
import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin:
      process.env.CLIENT_URL ||
      process.env.FRONTEND_URL ||
      "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

let dbConnected = false;
let dbConnectionError = null;

app.use((req, res, next) => {
  if (!req.path.startsWith("/api") || req.path === "/api/health") {
    return next();
  }

  if (!dbConnected) {
    connectDB()
      .then(() => {
        dbConnected = true;
        dbConnectionError = null;
        next();
      })
      .catch((error) => {
        dbConnectionError = error.message;
        res.status(500).json({ message: "Database connection failed" });
      });
  } else {
    next();
  }
});

app.use(rateLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/notes", notesRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", dbConnected, dbError: dbConnectionError });
});

export default app;
