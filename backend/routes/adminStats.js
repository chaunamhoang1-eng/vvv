import express from "express";
import AdminActivity from "../models/AdminActivity.js";

const router = express.Router();

/**
 * GET /api/admin/activity-stats
 * optional query: ?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get("/activity-stats", async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { from, to } = req.query;

    const filter = {
      adminId: req.session.admin.id
    };

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const completedOrders = await AdminActivity.countDocuments(filter);

    res.json({ completedOrders });

  } catch (err) {
    console.error("ADMIN STATS ERROR:", err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

export default router;
