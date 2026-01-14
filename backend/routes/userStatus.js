import express from "express";
import User from "../models/user.js";

const router = express.Router();

/**
 * GET /api/user/status
 * - Firebase auth handled in server.js
 * - Auto-migrates old users (email → firebaseUid)
 */
router.get("/status", async (req, res) => {
  try {
    // 🛑 SAFETY CHECK (VERY IMPORTANT)
    if (!req.firebaseUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { uid, email } = req.firebaseUser;

    // 1️⃣ Find by Firebase UID (new users)
    let user = await User.findOne({ firebaseUid: uid });

    // 2️⃣ Auto-migrate old users (email-based)
    if (!user && email) {
      user = await User.findOne({ email });

      if (user) {
        user.firebaseUid = uid;
        await user.save();
        console.log("✅ Auto-migrated old user:", email);
      }
    }

    // 3️⃣ User still not found → free user
    if (!user) {
      return res.json({
        hasPurchased: false,
        credits: 0,
        expiresAt: null
      });
    }

    // 4️⃣ Normal response
    return res.json({
      hasPurchased: Boolean(user.hasPurchased),
      credits: Number(user.credits || 0),
      expiresAt: user.expiresAt || null
    });

  } catch (err) {
    console.error("❌ User status error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
