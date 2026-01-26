// routes/plagResult.js
import express from "express";
import ApiOrder from "../models/ApiOrder.js";

const router = express.Router();

router.get("/result/:id", async (req, res) => {
  try {
    const order = await ApiOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    return res.json({
      success: true,
      order_id: order._id,
      status: order.status,                     // ⭐ REQUIRED
      ai_report: order.aiReport || null,        // ⭐ REQUIRED
      similarity_report: order.plagReport || null
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

export default router;
