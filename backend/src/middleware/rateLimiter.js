import ratelimit from "../config/upstash.js";

const rateLimiter = async (req, res, next) => {
  try {
    const userId = req.user?._id?.toString();
    const identifier =
      userId || req.ip || req.socket.remoteAddress || "unknown";
    const { success } = await ratelimit.limit(`api:${identifier}`);

    if (!success) {
      return res.status(429).json({
        message: "Too many attempts. Please try again later.",
      });
    }

    next();
  } catch (error) {
    console.log("Rate Limit Error:", error);
    // Allow request if rate limiter fails (don't block requests)
    next();
  }
};

export default rateLimiter;
