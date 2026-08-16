import express from "express";
import ProcessedPayment from "../models/ProcessedPayment.js";

const router = express.Router();

router.get("/purchase-history", async (req, res) => {
  try {
    const email = req.user?.email;

    if (!email) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const purchases = await ProcessedPayment.find({
      email: email.toLowerCase(),
    })
      .sort({ createdAt: -1 })
      .select(
        "productTitle credits amount currency createdAt paymentId"
      );

    return res.json({
      success: true,
      purchases,
    });

  } catch (error) {
    console.error(
      "Purchase history error:",
      error
    );

    return res.status(500).json({
      error: "Failed to load purchase history",
    });
  }
});

export default router;
