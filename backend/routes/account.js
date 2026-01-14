import express from "express";
import User from "../models/user.js";
import Order from "../models/Order.js";
import firebaseAuth from "../middleware/firebaseAuth.js";

const router = express.Router();

/**
 * ✅ SECURE
 * GET /api/account
 * Returns logged-in user's account info
 */
router.get("/", firebaseAuth, async (req, res) => {
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
 * ✅ SECURE
 * DELETE /api/account
 * Deletes logged-in user's account only
 */
router.delete("/", firebaseAuth, async (req, res) => {
  try {
    const { uid } = req.firebaseUser;

    // Delete user record
    await User.deleteOne({ firebaseUid: uid });

    // (Optional but recommended) delete user's orders
    await Order.deleteMany({ firebaseUid: uid });

    res.json({ success: true });

  } catch (err) {
    console.error("Account delete error:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
