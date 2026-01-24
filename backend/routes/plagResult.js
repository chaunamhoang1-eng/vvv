import express from "express";
import Order from "../models/Order.js";
import { requireApiKey } from "../middleware/requireApiKey.js";

const router = express.Router();

router.get("/result", requireApiKey, async (req, res) => {
  const { order_id } = req.query;

  if (!order_id) {
    return res.status(400).json({ success: false, message: "order_id required" });
  }

  const order = await Order.findById(order_id);

  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  return res.json({
    success: true,
    status: order.status,

    ai_index: order.aiReport?.percentage || null,
    similarity_index: order.plagReport?.percentage || null,

    ai_report_url: order.aiReport?.storedName || null,
    similarity_report_url: order.plagReport?.storedName || null
  });
});

export default router;
