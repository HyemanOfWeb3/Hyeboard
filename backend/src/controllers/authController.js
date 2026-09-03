import bcrypt from "bcryptjs";
import User from "../models/User.js";
import {
  AuthConfigurationError,
  clearSessionCookie,
  setSessionCookie,
} from "../middleware/auth.js";

const publicUser = (user) => ({ id: user._id, email: user.email });

export async function signup(req, res) {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !/^\S+@\S+\.\S+$/.test(email))
    return res.status(400).json({ message: "Enter a valid email address" });
  if (password.length < 8)
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters" });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash });
    setSessionCookie(res, user._id);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error instanceof AuthConfigurationError)
      return res
        .status(503)
        .json({ message: "Authentication service is not configured" });
    if (error?.code === 11000)
      return res
        .status(409)
        .json({ message: "An account with that email already exists" });
    console.error("Signup failed:", error.message);
    res.status(500).json({ message: "Could not create account" });
  }
}

export async function login(req, res) {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required" });
  try {
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash || "")))
      return res.status(401).json({ message: "Invalid email or password" });
    setSessionCookie(res, user._id);
    res.status(200).json({ user: publicUser(user) });
  } catch (error) {
    if (error instanceof AuthConfigurationError)
      return res
        .status(503)
        .json({ message: "Authentication service is not configured" });
    console.error("Login failed:", error.message);
    res.status(500).json({ message: "Unable to sign in right now" });
  }
}

export function logout(req, res) {
  clearSessionCookie(res);
  res.status(200).json({ message: "Logged out" });
}

export function currentUser(req, res) {
  res.status(200).json({ user: publicUser(req.user) });
}
