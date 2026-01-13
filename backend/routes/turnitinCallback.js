import express from "express";
import Order from "../models/Order.js";
import User from "../models/user.js";

const router = express.Router();

/* ================= CALLBACK ================= */

router.post("/turnitin/callback", async (req, res) => {
  try {
    const {
      event,
      external_order_id,
      status,
      result
    } = req.body;

    if (event !== "check_completed") {
      return res.status(400).json({ success: false });
    }

    const order = await Order.findById(external_order_id);
    if (!order) {
      return res.status(404).json({ success: false });
    }

    // ✅ IDEMPOTENCY (IMPORTANT)
    if (order.creditDeducted) {
      return res.json({ success: true, message: "already processed" });
    }

    if (status === "completed") {
      await Order.findByIdAndUpdate(order._id, {
        status: "completed",
        processing: false,
        completedAt: new Date(),

        aiReport: {
          filename: "AI Report",
          storedName: result.ai_report_url,
          percentage: result.ai_index
        },

        plagReport: {
          filename: "Plagiarism Report",
          storedName: result.similarity_report_url,
          percentage: result.similarity_index
        },

        creditDeducted: true
      });

      await User.updateOne(
        { email: order.email },
        {
          $inc: { credits: -1, totalUsed: 1 },
          $set: { lastUsedAt: new Date() }
        }
      );
    }

    return res.json({ success: true, message: "received" });

  } catch (err) {
    console.error("❌ TURNITIN CALLBACK ERROR:", err.message);
    return res.status(500).json({ success: false });
  }
});

export default router;
