import express from "express";
import Order from "../models/Order.js";

const router = express.Router();

/**
 * GET /api/reports
 * - Firebase auth handled in server.js
 * - Supports OLD (email-based) + NEW (firebaseUid-based) users
 * - Auto-links old orders to firebaseUid
 */
router.get("/", async (req, res) => {
  try {
    if (!req.firebaseUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { uid, email } = req.firebaseUser;

    // 1️⃣ Fetch reports by UID OR email (backward compatible)
    const reports = await Order.find({
      $or: [
        { firebaseUid: uid },
        { email }
      ]
    }).sort({ createdAt: -1 });

    // 2️⃣ Auto-migrate old reports (ONE TIME)
    const unmigratedIds = reports
      .filter(r => !r.firebaseUid)
      .map(r => r._id);

    if (unmigratedIds.length > 0) {
      await Order.updateMany(
        { _id: { $in: unmigratedIds } },
        { $set: { firebaseUid: uid } }
      );
      console.log(`✅ Migrated ${unmigratedIds.length} orders to firebaseUid`);
    }

    return res.json(reports);

  } catch (err) {
    console.error("❌ Fetch reports error:", err);
    return res.status(500).json({ error: "Failed to fetch reports" });
  }
});

export default router;
