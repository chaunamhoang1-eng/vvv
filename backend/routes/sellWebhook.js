import express from "express";
import User from "../models/user.js";

const router = express.Router();

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
      return res.status(400).json({ error: "Missing email or product" });
    }

    /* ================= CREDIT MAP ================= */
    let credits = 0;

    if (productTitle === "Individual Check") credits = 1;
    else if (productTitle === "3 Bundle Checks") credits = 3;
    else if (productTitle === "6 Bundle Checks") credits = 6;
    else if (productTitle === "10 Bundle Check") credits = 10;
    else if (productTitle === "50 Bundle Checks") credits = 50;

    if (!credits) {
      console.error("❌ Unknown product:", productTitle);
      return res.status(400).json({ error: "Unknown product" });
    }

    /* ================= EXPIRY (30 DAYS) ================= */
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    /* ================= UPDATE USER ================= */
    await User.findOneAndUpdate(
      { email },
      {
        $set: {
          hasPurchased: true,
          expiresAt // ✅ ADD THIS
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
      `✅ Purchase success: ${email} +${credits} credits, expires ${expiresAt.toISOString()}`
    );

    return res.json({ success: true });

  } catch (err) {
    console.error("🔥 Webhook error:", err);
    return res.status(500).json({ error: "Webhook failed" });
  }
});

export default router;
