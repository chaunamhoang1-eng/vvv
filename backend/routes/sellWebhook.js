import express from "express";
import User from "../models/user.js";
import ProcessedPayment from "../models/ProcessedPayment.js";

const router = express.Router();

router.post("/sell", async (req, res) => {
  try {
    // ================= PARSE PAYLOAD =================

    const payload =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

    console.log("📩 Webhook event:", payload?.event);

    // ================= EVENT CHECK =================

    if (payload?.event !== "order.completed") {
      return res.status(200).json({
        success: true,
        message: "Ignored event",
      });
    }

    // ================= PAYMENT / ORDER ID =================
    // SellApp order ID
    const paymentId = payload?.data?.id;

    if (!paymentId) {
      console.error("❌ Missing SellApp order ID");

      return res.status(400).json({
        success: false,
        error: "Missing payment/order ID",
      });
    }

    // ================= PAYMENT STATUS =================

    const status =
      payload?.data?.status?.status?.status ||
      payload?.data?.status?.status ||
      payload?.data?.status;

    if (status && status !== "COMPLETED") {
      console.log(
        `ℹ️ Payment ${paymentId} ignored. Status: ${status}`
      );

      return res.status(200).json({
        success: true,
        message: "Payment not completed",
      });
    }

    // ================= CUSTOMER =================

    const rawEmail =
      payload?.data?.customer_information?.email;

    const email = rawEmail?.toLowerCase()?.trim();

    const productTitle =
      payload?.data?.product_variants?.[0]?.product_title;

    if (!email || !productTitle) {
      console.error("❌ Missing email or product title");

      return res.status(400).json({
        success: false,
        error: "Missing email or product",
      });
    }

    // ================= CREDIT MAP =================

    let credits = 0;

    if (productTitle === "Individual Check") {
      credits = 1;
    } else if (productTitle === "3 Bundle Checks") {
      credits = 3;
    } else if (productTitle === "6 Bundle Checks") {
      credits = 6;
    } else if (
      productTitle === "10 Bundle Check" ||
      productTitle === "10 Bundle Check "
    ) {
      credits = 10;
    } else if (productTitle === "50 Bundle Checks") {
      credits = 50;
    }

    if (!credits) {
      console.error(
        "❌ Unknown product:",
        productTitle
      );

      return res.status(400).json({
        success: false,
        error: "Unknown product",
      });
    }

    // ====================================================
    // DUPLICATE PAYMENT PROTECTION
    // ====================================================

    try {
      await ProcessedPayment.create({
        paymentId: String(paymentId),
        email,
        credits,
        productTitle,
      });
    } catch (error) {
      // MongoDB duplicate key error
      if (error.code === 11000) {
        console.log(
          `♻️ Duplicate payment ignored: ${paymentId}`
        );

        return res.status(200).json({
          success: true,
          message: "Payment already processed",
        });
      }

      throw error;
    }

    // ================= FIND USER =================

    const existingUser = await User.findOne({
      email,
    });

    // ================= EXPIRY =================

    let expiresAt;

    if (
      existingUser?.expiresAt &&
      existingUser.expiresAt > new Date()
    ) {
      // Existing active subscription:
      // extend by another 30 days
      expiresAt = new Date(existingUser.expiresAt);

      expiresAt.setDate(
        expiresAt.getDate() + 30
      );
    } else {
      // New / expired subscription:
      // start 30 days from now
      expiresAt = new Date();

      expiresAt.setDate(
        expiresAt.getDate() + 30
      );
    }

    // ================= ADD CREDITS =================

    await User.findOneAndUpdate(
      { email },
      {
        $set: {
          hasPurchased: true,
          expiresAt,
        },

        $inc: {
          credits,
        },
      },
      {
        upsert: true,
        new: true,
      }
    );

    // ================= SUCCESS LOG =================

    console.log(
      `✅ Purchase success:
       Email: ${email}
       Payment: ${paymentId}
       Product: ${productTitle}
       Credits: +${credits}
       Expires: ${expiresAt.toISOString()}`
    );

    return res.status(200).json({
      success: true,
      message: "Purchase processed successfully",
      creditsAdded: credits,
    });

  } catch (err) {
    console.error(
      "🔥 SellApp webhook error:",
      err
    );

    return res.status(500).json({
      success: false,
      error: "Webhook failed",
    });
  }
});

export default router;
