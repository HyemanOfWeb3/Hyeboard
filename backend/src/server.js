//const express = require('express');
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

import notesRoutes from "./routes/notesRoutes.js";
import { connectDB } from "./config/db.js";
import rateLimiter from "./middleware/rateLimiter.js";

// Load environment variables from ../.env (if present)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const __dirname = path.resolve();
// const __dirname = path.dirname(new URL(import.meta.url).pathname);

//middleware
if (process.env.NODE_ENV !== "production") {
  app.use(
    cors({
      origin: "http://localhost:5173", // Adjust the origin as needed
    })
  );
}
app.use(express.json());
app.use(rateLimiter);

//app.use(rateLimiter);

app.use("/api/notes", notesRoutes);

// app.use(express.static(path.join(path.resolve(), "frontend", "dist")));

// app.get("*", (req, res) => {
//   res.sendFile(path.join(path.resolve(), "frontend", "dist", "index.html"));
// });

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
}

//connect to database and start the server

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log("Server is running on port:", PORT);
  });
});
