import express from "express";
import User from "../models/user.js";
import Order from "../models/Order.js";

const router = express.Router();

/**
 * ✅ GET /api/account
 * - Supports OLD users (email-based)
 * - Auto-links firebaseUid once
 * - Secure (cannot be abused via Postman)
 */
router.get("/", async (req, res) => {
  try {
    const { uid, email } = req.firebaseUser;

    // 🔎 Find by firebaseUid OR email (BACKWARD COMPATIBLE)
    let user = await User.findOne({
      $or: [
        { firebaseUid: uid },
        { email }
      ]
    });

    // ❌ No user in DB
    if (!user) {
      return res.status(404).json({
        email,
        credits: 0,
        purchasedAt: null
      });
    }

    // 🔗 Auto-link old users to Firebase UID (ONE TIME)
    if (!user.firebaseUid) {
      user.firebaseUid = uid;
      await user.save();
    }

    res.json({
      email: user.email,
      credits: user.credits ?? 0,
      purchasedAt: user.updatedAt
    });

  } catch (err) {
    console.error("Account fetch error:", err);
    res.status(500).json({ error: "Failed to fetch account" });
  }
});

/**
 * ✅ DELETE /api/account
 * - Deletes ONLY logged-in user
 * - Cannot be abused by email
 */
router.delete("/", async (req, res) => {
  try {
    const { uid } = req.firebaseUser;

    // Only delete by firebaseUid (SECURE)
    await User.deleteOne({ firebaseUid: uid });
    await Order.deleteMany({ firebaseUid: uid });

    res.json({ success: true });

  } catch (err) {
    console.error("Account delete error:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
