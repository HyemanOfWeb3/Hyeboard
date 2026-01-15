import mongoose from "mongoose";
import dotenv from "dotenv";






// Load environment variables from ../.env (if present)
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/notes_db";


export const connectDB = async () => {
  try {
    // Ensure a valid connection string is provided
    if (typeof MONGO_URI !== "string" || MONGO_URI.length === 0) {
      throw new Error("MONGO_URI is not defined or is not a string");
    }

    // Use the resolved MONGO_URI constant (not process.env directly)
    await mongoose.connect(MONGO_URI, {
      // Recommended options for stable connections
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log("MongoDB connected successfully!");
  } catch (error) {
    console.error("Error connecting to the database:", error.message || error);
    // Do not forcefully exit in deployed environments here — let the caller decide.
    // Re-throw so callers (or process managers like PM2/Render) can handle restarts.
    throw error;
  }
};