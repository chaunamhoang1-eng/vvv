import express from "express";
import Order from "../models/Order.js";
import adminAuth from "../middleware/adminAuth.js";

const router = express.Router();

/**
 * DELETE /api/admin/delete-report/:orderId/:type
 * type = ai | plag
 */
router.delete(
  "/delete-report/:orderId/:type",
  adminAuth, // ✅ JWT protection
  async (req, res) => {
    try {
      const { orderId, type } = req.params;

      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      /* ================= REMOVE REPORT ================= */
      if (type === "ai") {
        order.aiReport = undefined;
      }

      if (type === "plag") {
        order.plagReport = undefined;
      }

      /* ================= UPDATE STATUS ================= */
      order.status =
        order.aiReport?.storedName && order.plagReport?.storedName
          ? "completed"
          : "pending";

      await order.save();

      res.json({ message: "Report deleted successfully" });

    } catch (err) {
      console.error("DELETE REPORT ERROR:", err);
      res.status(500).json({ error: "Delete failed" });
    }
  }
);

export default router;
