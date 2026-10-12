
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

// Safely find a positive integer quantity from possible payload fields.
function getPurchaseQuantity(data) {
  const variant = data?.product_variants?.[0];

  const candidates = [
    data?.quantity,
    data?.product_quantity,
    data?.product_variants?.quantity,
    variant?.quantity,
    variant?.product_quantity,
    data?.items?.[0]?.quantity,
    data?.order_items?.[0]?.quantity
  ];

  for (const value of candidates) {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      const quantity = Number(value);

      if (Number.isSafeInteger(quantity) && quantity > 0) {
        return quantity;
      }
    }
  }

  return null;
}

router.post("/sell", async (req, res) => {
  let paymentKey;
  let processingClaimed = false;

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

    console.log("Sell.app event:", payload?.event);

    if (payload?.event !== "order.completed") {
      return res.status(200).json({
        success: true,
        message: "Ignored event"
      });
    }

    const data = payload?.data;

    // ================= PAYMENT DETAILS =================

    const paymentId = data?.id;

    if (
      paymentId == null ||
      String(paymentId).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing payment/order ID"
      });
    }

    paymentKey = String(paymentId);

    const status =
      data?.status?.status?.status ??
      data?.status?.status ??
      data?.status;

    if (
      status &&
      String(status).toUpperCase() !== "COMPLETED"
    ) {
      return res.status(200).json({
        success: true,
        message: "Payment not completed"
      });
    }

    const email = data?.customer_information?.email
      ?.toLowerCase()
      ?.trim();

    const productTitle = data?.product_variants?.[0]
      ?.product_title
      ?.trim();

    if (!email || !productTitle) {
      return res.status(400).json({
        success: false,
        error: "Missing customer email or product title"
      });
    }

    console.log("Payment ID:", paymentKey);
    console.log("Customer:", email);
    console.log("Product:", productTitle);

    // ================= DETERMINE CREDITS =================

    let creditType;
    let credits;

    if (productTitle === HUMANIZER_PRODUCT_TITLE) {
      creditType = "humanizer";
      credits = getPurchaseQuantity(data);

      if (credits === null) {
        // Temporary diagnostic: inspect this in Render logs.
        console.error(
          "Could not determine humanizer quantity. Payload:",
          JSON.stringify(data, null, 2)
        );

        return res.status(400).json({
          success: false,
          error: "Could not determine purchased quantity"
        });
      }
    } else {
      creditType = "plagiarism";
      credits = PLAGIARISM_PACKAGES[productTitle] || 0;
    }

    if (!credits) {
      console.error("Unknown product:", productTitle);

      return res.status(400).json({
        success: false,
        error: "Unknown product"
      });
    }

    console.log("Credit type:", creditType);
    console.log("Credits to grant:", credits);

    // ================= FIND USER =================

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User account not found for this purchase"
      });
    }

    // ================= RECORD PAYMENT =================

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

      payment = await ProcessedPayment.findOne({
        paymentId: paymentKey
      });

      if (!payment) {
        throw new Error(
          "Duplicate payment record could not be retrieved"
        );
      }

      // Never let a payment ID be reused for different details.
      if (
        payment.email !== email ||
        payment.productTitle !== productTitle ||
        Number(payment.credits) !== credits ||
        payment.creditType !== creditType
      ) {
        console.error(
          "Payment details mismatch:",
          paymentKey
        );

        return res.status(409).json({
          success: false,
          error: "Payment details do not match existing record"
        });
      }

      if (payment.creditStatus === "completed") {
        return res.status(200).json({
          success: true,
          message: "Payment already processed"
        });
      }
    }

    // ================= CLAIM PAYMENT =================

    // Only one webhook request can claim a pending payment.
    const claimedPayment =
      await ProcessedPayment.findOneAndUpdate(
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
      const currentPayment =
        await ProcessedPayment.findOne({
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
        message:
          "Payment is processing or requires reconciliation"
      });
    }

    processingClaimed = true;

    // ================= GRANT CREDITS =================

    const incrementField =
      creditType === "humanizer"
        ? "humanizerCredits"
        : "credits";

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
      throw new Error("Could not update user balance");
    }

    // ================= COMPLETE PAYMENT =================

    const completedPayment =
      await ProcessedPayment.updateOne(
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
      // Do not automatically credit again: the balance may
      // already have changed. Investigate this payment.
      throw new Error(
        "Balance updated but payment completion was not saved; reconciliation required"
      );
    }

    processingClaimed = false;

    const newBalance = updatedUser[incrementField];

    console.log(
      `Purchase successful: ${email} | +${credits} ${creditType} credits`
    );
    console.log("New balance:", newBalance);

    return res.status(200).json({
      success: true,
      message: "Purchase processed successfully",
      creditType,
      creditsAdded: credits,
      newBalance
    });
  } catch (error) {
    console.error("Sell.app webhook error:", error);

    // Do not automatically reset a claimed payment to pending:
    // the balance update may already have succeeded.
    if (paymentKey && processingClaimed) {
      try {
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
      } catch (statusError) {
        console.error(
          "Could not mark payment for review:",
          statusError.message
        );
      }
    }

    return res.status(500).json({
      success: false,
      error: "Webhook failed"
    });
  }
});

export default router;
