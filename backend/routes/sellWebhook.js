```js
import express from "express";
import User from "../models/user.js";
import ProcessedPayment from "../models/ProcessedPayment.js";

const router = express.Router();

// Must match the product title in Sell.app exactly.
const HUMANIZER_PRODUCT_TITLE = "Humanizing Services";

router.post("/sell", async (req, res) => {
  try {
    // ================= PARSE WEBHOOK =================

    let payload;

    if (Buffer.isBuffer(req.body)) {
      payload = JSON.parse(req.body.toString("utf8"));
    } else if (typeof req.body === "string") {
      payload = JSON.parse(req.body);
    } else {
      payload = req.body;
    }

    console.log("📩 Webhook event:", payload?.event);

    if (payload?.event !== "order.completed") {
      return res.status(200).json({
        success: true,
        message: "Ignored event",
      });
    }

    // ================= PAYMENT DETAILS =================

    const paymentId = payload?.data?.id;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: "Missing payment/order ID",
      });
    }

    const status =
      payload?.data?.status?.status?.status ||
      payload?.data?.status?.status ||
      payload?.data?.status;

    if (status && status !== "COMPLETED") {
      return res.status(200).json({
        success: true,
        message: "Payment not completed",
      });
    }

    const email = payload?.data?.customer_information
      ?.email?.toLowerCase()?.trim();

    const productTitle =
      payload?.data?.product_variants?.[0]?.product_title
        ?.trim();

    if (!email || !productTitle) {
      return res.status(400).json({
        success: false,
        error: "Missing email or product",
      });
    }

    console.log("🆔 Payment:", paymentId);
    console.log("📧 Customer:", email);
    console.log("📦 Product:", productTitle);

    // ================= ROUTE CREDITS =================

    let creditType;
    let credits = 0;

    if (productTitle === HUMANIZER_PRODUCT_TITLE) {
      // Separate Humanizer balance.
      creditType = "humanizer";
      credits = 1;
    } else {
      // Existing plagiarism products — unchanged.
      creditType = "plagiarism";

      const plagiarismPackages = {
        "Individual Check": 1,
        "3 Bundle Checks": 3,
        "6 Bundle Checks": 6,
        "10 Bundle Check": 10,
        "50 Bundle Checks": 50,
      };

      credits = plagiarismPackages[productTitle] || 0;
    }

    if (!credits) {
      console.error("❌ Unknown product:", productTitle);

      return res.status(400).json({
        success: false,
        error: "Unknown product",
      });
    }

    // ================= FIND USER =================

    const user = await User.findOne({ email });

    if (!user) {
      // Avoid creating an incomplete account without credentials.
      // The payment can be retried after the account is created.
      return res.status(404).json({
        success: false,
        error: "User account not found for this purchase",
      });
    }

    // ================= DUPLICATE PROTECTION =================

    // ProcessedPayment.paymentId must have a unique index.
    // This record is created before the balance update, matching
    // the structure of your existing webhook.
    try {
      await ProcessedPayment.create({
        paymentId: String(paymentId),
        email,
        credits: creditType === "plagiarism" ? credits : 0,
        productTitle,
      });
    } catch (error) {
      if (error.code === 11000) {
        console.log("♻️ Duplicate payment ignored:", paymentId);

        return res.status(200).json({
          success: true,
          message: "Payment already processed",
        });
      }

      throw error;
    }

    // ================= ADD THE RIGHT CREDITS =================

    const incrementField =
      creditType === "humanizer"
        ? "humanizerCredits"
        : "credits";

    const update = {
      $inc: {
        [incrementField]: credits,
      },
    };

    if (creditType === "plagiarism") {
      update.$set = {
        hasPurchased: true,
      };
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id },
      update,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      throw new Error("Could not update user credit balance");
    }

    const newBalance = updatedUser[incrementField];

    console.log(
      `✅ ${creditType} purchase: ${email} | +${credits} credits`
    );
    console.log(`💰 New ${creditType} balance: ${newBalance}`);

    return res.status(200).json({
      success: true,
      message: "Purchase processed successfully",
      creditType,
      creditsAdded: credits,
      newBalance,
    });
  } catch (err) {
    console.error("🔥 SellApp webhook error:", err);

    return res.status(500).json({
      success: false,
      error: "Webhook failed",
    });
  }
});

export default router;
```
