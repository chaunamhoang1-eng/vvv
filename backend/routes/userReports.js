import express from "express";
import Order from "../models/Order.js";
import firebaseAuth from "../middleware/firebaseAuth.js";

const router = express.Router();

/**
 * ✅ SECURE
 * GET /api/reports
 * Returns reports for logged-in user only
 */
router.get("/reports", firebaseAuth, async (req, res) => {
  try {
    const { uid } = req.firebaseUser;

    const reports = await Order.find({ firebaseUid: uid })
      .sort({ createdAt: -1 });

    res.json(reports);

  } catch (err) {
    console.error("Fetch reports error:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

export default router;
