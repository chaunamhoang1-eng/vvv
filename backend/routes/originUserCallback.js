import express from "express";
import Order from "../models/Order.js";
import User from "../models/user.js";

const router = express.Router();

router.post("/normal-user/origincheck", async (req, res) => {
  try {
    const body = req.body;
    const historyId = body.history_id;
    const orderId = body.external_order_id;

    const result = body.result;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false });

    const aiData = {
      filename: "AI Report",
      storedName: result.ai_report_url,
      percentage: result.ai_index
    };

    const plagData = {
      filename: "Similarity Report",
      storedName: result.similarity_report_url,
      percentage: result.similarity_index
    };

    await Order.findByIdAndUpdate(orderId, {
      status: body.status, // completed
      completedAt: new Date(),
      processing: false,
      aiReport: aiData,
      plagReport: plagData,
      creditDeducted: true
    });

    // Deduct user credit
    await User.updateOne(
      { email: order.email },
      { $inc: { credits: -1, totalUsed: 1 }, $set: { lastUsedAt: new Date() } }
    );

    console.log("✅ Callback processed for order:", orderId);

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Callback error:", err.message);
    res.status(500).json({ success: false });
  }
});

export default router;
