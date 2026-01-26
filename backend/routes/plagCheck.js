import express from "express";
import { requireApiKey } from "../middleware/requireApiKey.js";
import ApiOrder from "../models/ApiOrder.js";
import { processOriginCheck } from "../services/externalCheck.js";

const router = express.Router();

/* Extract filename */
const extractFilename = (url) => {
  try {
    return url.split("/").pop() || "FILE";
  } catch {
    return "FILE";
  }
};

router.post("/check", requireApiKey, async (req, res) => {
  const user = req.apiUser;
  const { file_url } = req.body;

  if (!file_url) {
    return res.status(400).json({ success: false, message: "file_url required" });
  }

  if (user.credits <= 0) {
    return res.status(402).json({ success: false, message: "No credits left" });
  }

  try {
    const filename = extractFilename(file_url);

    const order = await ApiOrder.create({
      apiKey: user.apiKey,
      fileURL: file_url,
      filename,
      storedName: filename,
      status: "pending"
    });

    // Start async processing with polling
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
      message: err.message
    });
  }
});

export default router;
