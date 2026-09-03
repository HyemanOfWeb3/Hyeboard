import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const SESSION_COOKIE = "hyeboard_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function getSecret() {
  if (!process.env.AUTH_SECRET)
    throw new Error("AUTH_SECRET is not configured");
  return process.env.AUTH_SECRET;
}

export function setSessionCookie(res, userId) {
  const token = jwt.sign({ sub: userId.toString() }, getSecret(), {
    expiresIn: "7d",
  });
  const secure = process.env.NODE_ENV === "production";
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token)
      return res.status(401).json({ message: "Authentication required" });
    const payload = jwt.verify(token, getSecret());
    const user = await User.findById(payload.sub).select("_id email").lean();
    if (!user)
      return res.status(401).json({ message: "Authentication required" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Authentication required" });
  }
}
