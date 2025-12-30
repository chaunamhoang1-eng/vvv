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

    // ✅ CREATE JWT (NO SESSION)
    const token = jwt.sign(
      {
        id: admin._id,
        username: admin.username
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token
    });
  } catch (err) {
    console.error("ADMIN LOGIN ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= ADMIN LOGOUT ================= */
/* JWT logout is handled on frontend by deleting token */
router.post("/logout", (_req, res) => {
  res.json({ message: "Logged out" });
});

export default router;
