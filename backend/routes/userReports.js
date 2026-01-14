import express from "express";
import Order from "../models/Order.js";

const router = express.Router();

/**
 * GET /api/reports
 * Firebase auth is already handled in server.js
 */
router.get("/reports", async (req, res) => {
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
