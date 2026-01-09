import express from "express";
import User from "../models/user.js";

const router = express.Router();

/**
 * GET /api/user/status/:email
 */
router.get("/status/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });

    if (!user) {
      return res.json({
        hasPurchased: false,
        credits: 0,
        expiresAt: null
      });
    }

    res.json({
      hasPurchased: user.hasPurchased ?? false,
      credits: user.credits ?? 0,
      expiresAt: user.expiresAt || null   // ✅ REQUIRED
    });

  } catch (err) {
    console.error("User status error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
