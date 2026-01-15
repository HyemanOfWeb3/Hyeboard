import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables from ../.env (if present)
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

// In production, MONGO_URI is required
if (!MONGO_URI) {
  console.warn("⚠️  MONGO_URI environment variable is not set!");
  console.warn(
    "Set MONGO_URI in your environment variables for database connectivity"
  );
}

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
    if (!MONGO_URI || typeof MONGO_URI !== "string" || MONGO_URI.length === 0) {
      throw new Error(
        "MONGO_URI environment variable is required but not set. Please configure it in your deployment settings."
      );
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
