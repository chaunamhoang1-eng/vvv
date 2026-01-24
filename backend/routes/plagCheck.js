import express from "express";
import { requireApiKey } from "../middleware/requireApiKey.js";
import { processOriginCheck } from "../services/externalCheck.js";
import ApiUser from "../models/ApiUser.js";
import Order from "../models/Order.js";

const router = express.Router();

router.post("/check", requireApiKey, async (req, res) => {
  const user = req.apiUser;
  const { file_url } = req.body;

  if (!file_url) {
    return res.status(400).json({ success: false, error: "file_url required" });
  }

  // 🔒 Block inactive API users
  if (user.status !== "active") {
    return res.status(403).json({
      success: false,
      message: "API key is blocked"
    });
  }

  // 🔑 Activation code required
  if (!user.activationCode) {
    return res.status(500).json({
      success: false,
      message: "Activation code not assigned to this API key"
    });
  }

  // 💳 Credit check
  if (user.credits <= 0) {
    return res.status(402).json({
      success: false,
      message: "No credits left"
    });
  }

  try {
    // 📌 Create internal order
    const order = await Order.create({
      email: user.email || "api_user",
      file_url,
      status: "queued"
    });

    // 🚀 Start background OriginCheck process
    // (Does not block API response)
    processOriginCheck(order._id, file_url);

    return res.json({
      success: true,
      message: "File submitted successfully",
      order_id: order._id,
      credits_left: user.credits     // Credit deducted after completion
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Plagiarism check failed"
    });
  }
});

export default router;
