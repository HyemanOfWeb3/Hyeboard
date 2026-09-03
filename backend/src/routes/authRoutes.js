import express from "express";
import {
  currentUser,
  login,
  logout,
  signup,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", requireAuth, currentUser);

export default router;
