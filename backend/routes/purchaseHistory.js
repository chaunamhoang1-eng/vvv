import express from "express";
import ProcessedPayment from "../models/ProcessedPayment.js";

const router = express.Router();

router.get("/purchase-history", async (req, res) => {
  try {

    // Firebase middleware stores user here
    const email = req.firebaseUser?.email;

    if (!email) {
      console.error("❌ Purchase history: Firebase email missing");

      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    console.log(
      "📋 Loading purchase history for:",
      email
    );

    const purchases = await ProcessedPayment.find({
      email: email.toLowerCase()
    })
      .sort({ createdAt: -1 })
      .select(
        "productTitle credits amount currency createdAt paymentId"
      )
      .lean();

    console.log(
      `✅ Found ${purchases.length} purchases for ${email}`
    );

    return res.json({
      success: true,
      purchases
    });

  } catch (error) {

    console.error(
      "❌ Purchase history error:",
      error
    );

    return res.status(500).json({
      error: "Failed to load purchase history"
    });
  }
});

export default router;
