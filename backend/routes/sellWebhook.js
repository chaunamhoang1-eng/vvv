
import express from "express";
import User from "../models/user.js";
import ProcessedPayment from "../models/ProcessedPayment.js";

const router = express.Router();

const HUMANIZER_PRODUCT_TITLE = "Humanizing Services";

const PLAGIARISM_PACKAGES = {
  "Individual Check": 1,
  "3 Bundle Checks": 3,
  "6 Bundle Checks": 6,
  "10 Bundle Check": 10,
  "50 Bundle Checks": 50
};

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
        message: "Ignored event"
      });
    }

    // ================= PAYMENT DETAILS =================

    const paymentId = payload?.data?.id;

    if (paymentId == null || String(paymentId).trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Missing payment/order ID"
      });
    }

    const status =
      payload?.data?.status?.status?.status ||
      payload?.data?.status?.status ||
      payload?.data?.status;

    if (status && status !== "COMPLETED") {
      return res.status(200).json({
        success: true,
        message: "Payment not completed"
      });
    }

    const email = payload?.data?.customer_information
      ?.email?.toLowerCase()?.trim();

    const productTitle = payload?.data?.product_variants?.[0]
      ?.product_title?.trim();

    if (!email || !productTitle) {
      return res.status(400).json({
        success: false,
        error: "Missing email or product"
      });
    }

    const paymentKey = String(paymentId);

    console.log("🆔 Payment:", paymentKey);
    console.log("📧 Customer:", email);
    console.log("📦 Product:", productTitle);

    // ================= DETERMINE CREDIT TYPE =================

    let creditType;
    let credits;

    if (productTitle === HUMANIZER_PRODUCT_TITLE) {
      creditType = "humanizer";
      credits = 1;
    } else {
      creditType = "plagiarism";
      credits = PLAGIARISM_PACKAGES[productTitle] || 0;
    }

    if (!credits) {
      console.error("❌ Unknown product:", productTitle);

      return res.status(400).json({
        success: false,
        error: "Unknown product"
      });
    }

    // ================= FIND USER =================

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User account not found for this purchase"
      });
    }

    // ================= RECORD PAYMENT =================

    // Always store a positive purchase quantity. The field describes
    // the purchase quantity, not which User balance will be updated.
    let payment;

    try {
      payment = await ProcessedPayment.create({
        paymentId: paymentKey,
        email,
        credits,
        productTitle,
        creditType,
        creditStatus: "pending"
      });
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }

      // A duplicate can be an earlier failed attempt. Only retry a
      // pending payment if its recorded details match this event.
      payment = await ProcessedPayment.findOne({
        paymentId: paymentKey
      });

      if (!payment) {
        throw new Error("Duplicate payment record could not be retrieved");
      }

      if (
        payment.email !== email ||
        payment.productTitle !== productTitle ||
        payment.credits !== credits ||
        payment.creditType !== creditType
      ) {
        console.error("Payment ID details do not match existing record:", {
          paymentKey,
          email,
          productTitle
        });

        return res.status(409).json({
          success: false,
          error: "Payment ID does not match the existing payment record"
        });
      }

      if (payment.creditStatus === "completed") {
        return res.status(200).json({
          success: true,
          message: "Payment already processed"
        });
      }

      console.log("🔄 Retrying pending credit grant:", paymentKey);
    }

    // ================= GRANT CREDITS =================

    const incrementField =
      creditType === "humanizer"
        ? "humanizerCredits"
        : "credits";

    // Conditional status update prevents two concurrent webhook
    // deliveries from granting the same payment twice.
    const claimedPayment = await ProcessedPayment.findOneAndUpdate(
      {
        paymentId: paymentKey,
        creditStatus: "pending"
      },
      {
        $set: {
          creditStatus: "processing"
        }
      },
      {
        new: true
      }
    );

    if (!claimedPayment) {
      const currentPayment = await ProcessedPayment.findOne({
        paymentId: paymentKey
      });

      if (currentPayment?.creditStatus === "completed") {
        return res.status(200).json({
          success: true,
          message: "Payment already processed"
        });
      }

      return res.status(409).json({
        success: false,
        message: "Payment is already being processed; retry later"
      });
    }

    try {
      const update = {
        $inc: {
          [incrementField]: credits
        }
      };

      if (creditType === "plagiarism") {
        update.$set = {
          hasPurchased: true
        };
      }

      const updatedUser = await User.findOneAndUpdate(
        { _id: user._id },
        update,
        {
          new: true,
          runValidators: true
        }
      );

      if (!updatedUser) {
        throw new Error("Could not update user credit balance");
      }

      // Mark the payment complete after granting the credits.
      const completedPayment = await ProcessedPayment.updateOne(
        {
          paymentId: paymentKey,
          creditStatus: "processing"
        },
        {
          $set: {
            creditStatus: "completed"
          }
        }
      );

      if (completedPayment.modifiedCount !== 1) {
        // Do not blindly grant again. This requires reconciliation
        // because the user balance may already have been updated.
        throw new Error(
          "Credits granted but payment completion status could not be saved"
        );
      }

      const newBalance = updatedUser[incrementField];

      console.log(
        `✅ ${creditType} purchase processed: ${email} | +${credits}`
      );
      console.log(`💰 New ${creditType} balance: ${newBalance}`);

      return res.status(200).json({
        success: true,
        message: "Purchase processed successfully",
        creditType,
        creditsAdded: credits,
        newBalance
      });
    } catch (grantError) {
      console.error("Credit grant failed:", {
        paymentKey,
        creditType,
        message: grantError.message
      });

      // Leave the record pending only if we know the balance update
      // did not succeed. If it may have succeeded, mark it for manual
      // reconciliation rather than risking a duplicate credit grant.
      await ProcessedPayment.updateOne(
        {
          paymentId: paymentKey,
          creditStatus: "processing"
        },
        {
          $set: {
            creditStatus: "review"
          }
        }
      );

      throw grantError;
    }
  } catch (err) {
    console.error("🔥 SellApp webhook error:", err);

    return res.status(500).json({
      success: false,
      error: "Webhook failed"
    });
  }
});

export default router;
