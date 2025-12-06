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


    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully!");
    
  } catch (error) {
    console.error("Error connecting to the database", error);
    process.exit(1); // Exit the process with failure
  }
};