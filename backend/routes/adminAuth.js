import express from "express";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

const router = express.Router();

/* ================= ADMIN LOGIN ================= */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username });
    if (!admin || admin.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // ✅ CREATE JWT
    const token = jwt.sign(
      { id: admin._id, username: admin.username, isAdmin: true },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= ADMIN LOGOUT ================= */
router.get("/logout", (req, res) => {
  res.json({ message: "Logged out" });
});

export default router;
