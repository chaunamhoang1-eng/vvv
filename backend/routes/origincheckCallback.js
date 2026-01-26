import express from "express";
import Order from "../models/Order.js";

const router = express.Router();

router.post("/normal-user/origincheck", async (req, res) => {
  console.log("📥 CALLBACK RECEIVED:", JSON.stringify(req.body, null, 2));

  try {
    const body = req.body;

    if (!body.success || !body.data) {
      return res.status(400).json({ success: false, message: "Invalid callback" });
    }

    const data = body.data;
    const result = data.result || {};

    const orderId =
      data.external_order_id ||
      data.oid_id?.split(":").pop();

    if (!orderId) {
      console.log("❌ Callback missing order ID");
      return res.json({ success: false });
    }

    await Order.findByIdAndUpdate(orderId, {
      status: data.status,
      processing: false,

      aiReport: {
        filename: "AI Report",
        storedName: result.ai_report_url || null,
        percentage: result.ai_index ?? null
      },

      plagReport: {
        filename: "Plagiarism Report",
        storedName: result.similarity_report_url || null,
        percentage: result.similarity_index ?? null
      }
    });

    console.log("✅ CALLBACK SAVED FOR:", orderId);

    return res.json({ success: true });

  } catch (err) {
    console.error("❌ CALLBACK ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

export default router;
