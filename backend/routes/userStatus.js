import express from "express";
import User from "../models/user.js";
import firebaseAuth from "../middleware/firebaseAuth.js";

const router = express.Router();

/**
 * GET /api/user/status
 * - Auth required
 * - Auto-migrates old users (email → firebaseUid)
 */
router.get("/status", firebaseAuth, async (req, res) => {
  try {
    const { uid, email } = req.firebaseUser;

    // 1️⃣ Try finding user by Firebase UID (new system)
    let user = await User.findOne({ firebaseUid: uid });

    // 2️⃣ Auto-migrate old users (created before UID existed)
    if (!user && email) {
      user = await User.findOne({ email });

      if (user) {
        user.firebaseUid = uid;
        await user.save();
        console.log("✅ Auto-migrated old user:", email);
      }
    }

    // 3️⃣ User still not found
    if (!user) {
      return res.json({
        hasPurchased: false,
        credits: 0,
        expiresAt: null
      });
    }

    // 4️⃣ Normal response
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
