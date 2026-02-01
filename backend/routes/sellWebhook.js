import express from "express";
import User from "../models/user.js";

const router = express.Router();

/**
 * SELL WEBHOOK
 * - Adds credits
 * - Sets / extends expiry by 30 days
 */
router.post("/sell", async (req, res) => {
  try {
    const payload = JSON.parse(req.body.toString());

    console.log("📩 Webhook event:", payload.event);

    /* ================= PAYMENT STATUS CHECK ================= */
    const status =
      payload.data?.status?.status?.status ||
      payload.data?.status?.status;

    if (status !== "COMPLETED") {
      return res.status(200).json({ message: "Ignored (not completed)" });
    }

    /* ================= EXTRACT DATA ================= */
    const email = payload.data?.customer_information?.email;
    const productTitle =
      payload.data?.product_variants?.[0]?.product_title;

    if (!email || !productTitle) {
      console.error("❌ Missing email or product title");
      return res.status(400).json({ error: "Missing email or product" });
    }

    /* ================= CREDIT MAP ================= */
    let credits = 0;

    if (productTitle === "Individual Check") credits = 1;
    else if (productTitle === "3 Bundle Checks") credits = 3;
    else if (productTitle === "6 Bundle Checks") credits = 6;
    else if (productTitle === "10 Bundle Check ") credits = 10;
    else if (productTitle === "50 Bundle Checks") credits = 50;

    if (!credits) {
      console.error("❌ Unknown product:", productTitle);
      return res.status(400).json({ error: "Unknown product" });
    }

    /* ================= FETCH USER ================= */
    const existingUser = await User.findOne({ email });

    /* ================= EXPIRY LOGIC (EXTEND) ================= */
    let expiresAt;

    if (existingUser?.expiresAt && existingUser.expiresAt > new Date()) {
      // ✅ Extend active plan
      expiresAt = new Date(existingUser.expiresAt);
      expiresAt.setDate(expiresAt.getDate() + 30);
    } else {
      // ✅ Fresh 30-day plan
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
    }

    /* ================= UPDATE USER ================= */
    await User.findOneAndUpdate(
      { email },
      {
        $set: {
          hasPurchased: true,
          expiresAt
        },
        $inc: {
          credits
        }
      },
      {
        upsert: true,
        new: true
      }
    );

    console.log(
      `✅ Purchase success: ${email} | +${credits} credits | expires ${expiresAt.toISOString()}`
    );

    return res.json({ success: true });

  } catch (err) {
    console.error("🔥 Webhook error:", err);
    return res.status(500).json({ error: "Webhook failed" });
  }
});

export default router;
