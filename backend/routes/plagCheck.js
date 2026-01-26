// routes/plagCheck.js
import express from "express";
import { requireApiKey } from "../middleware/requireApiKey.js";
import { processOriginCheck } from "../services/externalCheck.js";
import ApiOrder from "../models/ApiOrder.js";

const router = express.Router();

function extractFilename(url) {
  try {
    return new URL(url).pathname.split("/").pop() || "FILE";
  } catch {
    return "FILE";
  }
}

router.post("/check", requireApiKey, async (req, res) => {
  const user = req.apiUser;
  const { file_url } = req.body;

  if (!file_url)
    return res.status(400).json({ success: false, error: "file_url required" });

  if (user.status !== "active")
    return res.status(403).json({ success: false, message: "API key blocked" });

  if (!user.activationCode)
    return res
      .status(500)
      .json({ success: false, message: "Activation code missing" });

  if (user.credits <= 0)
    return res.status(402).json({ success: false, message: "No credits left" });

  try {
    const filename = extractFilename(file_url);

    const order = await ApiOrder.create({
      apiKey: user.apiKey,
      callbackURL: user.callbackURL,

      fileURL: file_url,
      filename,
      storedName: filename,

      status: "pending"
    });

    processOriginCheck(order._id, file_url);

    return res.json({
      success: true,
      message: "File submitted",
      order_id: order._id,
      credits_left: user.credits
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Something went wrong"
    });
  }
});

export default router;
