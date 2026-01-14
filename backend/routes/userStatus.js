import express from "express";
import User from "../models/user.js";
import firebaseAuth from "../middleware/firebaseAuth.js";

const router = express.Router();

/**
 * ✅ SECURE
 * GET /api/user/status
 * Auth required (Firebase ID token)
 */
router.get("/status", firebaseAuth, async (req, res) => {
  try {
    const uid = req.firebaseUser.uid;

    const user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      return res.json({
        hasPurchased: false,
        credits: 0,
        expiresAt: null
      });
    }

    res.json({
      hasPurchased: Boolean(user.hasPurchased),
      credits: Number(user.credits || 0),
      expiresAt: user.expiresAt || null
    });

  } catch (err) {
    console.error("User status error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
