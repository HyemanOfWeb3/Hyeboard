import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables from ../.env (if present)
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/notes_db";

// Cache connection for serverless functions
let cachedConnection = null;

export const connectDB = async () => {
  try {
    // Return cached connection if it exists and is still valid
    if (cachedConnection && mongoose.connection.readyState === 1) {
      console.log("Using cached MongoDB connection");
      return cachedConnection;
    }

    // Ensure a valid connection string is provided
    if (typeof MONGO_URI !== "string" || MONGO_URI.length === 0) {
      throw new Error("MONGO_URI is not defined or is not a string");
    }

    console.log("Creating new MongoDB connection...");

    // Connect to MongoDB
    const connection = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      // Serverless-friendly options
      maxPoolSize: 1,
      minPoolSize: 0,
    });

    // Cache the connection
    cachedConnection = connection;
    console.log("MongoDB connected successfully!");

    return connection;
  } catch (error) {
    console.error("Error connecting to the database:", error.message || error);
    throw error;
  }
};
