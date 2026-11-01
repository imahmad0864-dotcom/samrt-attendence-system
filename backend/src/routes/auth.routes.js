import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Bootstrap the first admin only when no users exist. After that, only an authenticated
// admin can create additional users via the protected endpoint.
router.post("/setup", async (req, res, next) => {
  try {
    if (await User.exists({})) {
      return res.status(409).json({ success: false, message: "Setup is already complete. Sign in." });
    }
    const { name, email, password } = req.body;
    if (!name || !email || typeof password !== "string" || password.length < 12) {
      return res.status(400).json({ success: false, message: "Provide name, email, and a password of at least 12 characters." });
    }
    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "admin"
    });
    return res.status(201).json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || "").toLowerCase().trim() }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(String(password || ""), user.passwordHash))) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      return res.status(500).json({ success: false, message: "JWT_SECRET must be set to a random secret of at least 32 characters." });
    }
    const token = jwt.sign({ sub: user.id, role: user.role, name: user.name }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h"
    });
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(401).json({ success: false, message: "User no longer exists." });
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
});

// Optional endpoint to add teacher/admin accounts after first setup.
router.post("/users", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, email, password, role = "teacher" } = req.body;
    if (!name || !email || typeof password !== "string" || password.length < 12) {
      return res.status(400).json({ success: false, message: "Provide name, email, and a password of at least 12 characters." });
    }
    if (!["admin", "teacher"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role." });
    }
    const user = await User.create({
      name, email, role, passwordHash: await bcrypt.hash(password, 12)
    });
    res.status(201).json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
});

export default router;
