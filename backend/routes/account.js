import express from "express";
import User from "../models/user.js";
import Order from "../models/Order.js";

const router = express.Router();

/**
 * GET /api/account
 * Firebase auth already handled in server.js
 */
router.get("/", async (req, res) => {
  try {
    const { uid, email } = req.firebaseUser;

    const user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      return res.status(404).json({});
    }

    res.json({
      email: user.email || email,
      credits: user.credits ?? 0,
      purchasedAt: user.updatedAt
    });

  } catch (err) {
    console.error("Account fetch error:", err);
    res.status(500).json({ error: "Failed to fetch account" });
  }
});

/**
 * DELETE /api/account
 * Deletes logged-in user's account only
 */
router.delete("/", async (req, res) => {
  try {
    const { uid } = req.firebaseUser;

    await User.deleteOne({ firebaseUid: uid });
    await Order.deleteMany({ firebaseUid: uid });

    res.json({ success: true });

  } catch (err) {
    console.error("Account delete error:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
