import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import dotenv from "dotenv";
dotenv.config();

//create a ratelimiter, that allows 10 requests per 20 seconds
let ratelimit;

try {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "20 s"),
  });
} catch (error) {
  console.warn("Rate limiter not configured:", error.message);
  // Create a mock rate limiter if Redis is not configured
  ratelimit = {
    limit: async () => ({ success: true }),
  };
}

export default ratelimit;
