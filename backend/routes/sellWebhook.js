import express from "express";
import User from "../models/user.js";

const router = express.Router();

router.post("/sell", async (req, res) => {
  try {
    const payload = JSON.parse(req.body.toString());

    if (payload.event !== "order.completed") {
      return res.status(200).json({ message: "Ignored" });
    }

    const email = payload.data.customer_email;
    const productName = payload.data.product_name;

    let credits = 0;
    if (productName.includes("Basic")) credits = 5;
    else if (productName.includes("Standard")) credits = 10;
    else if (productName.includes("Pro")) credits = 25;

    if (!credits) {
      return res.status(400).json({ message: "Unknown plan" });
    }

    await User.findOneAndUpdate(
      { email },
      {
        $set: { hasPurchased: true },
        $inc: { credits }
      },
      { upsert: true }
    );

    console.log(`✅ Sell.app order complete: ${email} +${credits} credits`);
    res.json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook failed" });
  }
});

export default router;
