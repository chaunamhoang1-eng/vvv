import express from "express";
import Order from "../models/Order.js";

const router = express.Router();

/**
 * GET /api/reports
 * - Firebase auth handled in server.js
 * - Supports OLD (email-based) + NEW (firebaseUid-based) users
 * - Auto-links old orders to firebaseUid
 */
router.get("/reports", async (req, res) => {
  try {
    const { uid, email } = req.firebaseUser;

    // 1️⃣ Fetch reports by UID OR email (backward compatible)
    const reports = await Order.find({
      $or: [
        { firebaseUid: uid },
        { email }
      ]
    }).sort({ createdAt: -1 });

    // 2️⃣ Auto-migrate old reports (ONE TIME)
    const unmigrated = reports.filter(r => !r.firebaseUid);

    if (unmigrated.length > 0) {
      await Order.updateMany(
        { _id: { $in: unmigrated.map(r => r._id) } },
        { $set: { firebaseUid: uid } }
      );
      console.log(`✅ Migrated ${unmigrated.length} orders to firebaseUid`);
    }

    res.json(reports);

  } catch (err) {
    console.error("Fetch reports error:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

export default router;
