import express from "express";
import { requireApiKey } from "../middleware/requireApiKey.js";
import { runPlagCheck } from "../services/externalCheck.js";
import ApiUser from "../models/ApiUser.js";

const router = express.Router();

router.post("/check", requireApiKey, async (req, res) => {
  const user = req.apiUser;
  const { file_url } = req.body;

  if (!file_url) {
    return res.status(400).json({ error: "file_url required" });
  }

  // 🔒 Block if no credits
  if (user.credits <= 0) {
    return res.status(402).json({
      success: false,
      message: "No credits left"
    });
  }

  try {
    // ▶️ Call external API
    const data = await runPlagCheck(file_url);

    /**
     * ✅ HARD SUCCESS CHECK
     * Adjust based on your API response structure
     */
    if (!data || !data.taskId) {
      return res.status(400).json({
        success: false,
        message: "Plagiarism check not accepted",
        details: data
      });
    }

    // ✅ Deduct credit ONLY here
    user.credits -= 1;
    user.totalUsed += 1;
    user.lastUsedAt = new Date();
    await user.save();

    return res.json({
      success: true,
      task_id: data.taskId,
      credits_left: user.credits,
      ai_score: data.ai_score ?? null,
      similarity_score: data.similarity_score ?? null,
      outputs: data.outputs ?? null
    });

  } catch (err) {
    console.error("PLAG CHECK ERROR:", err?.response?.data || err.message);

    return res.status(400).json({
      success: false,
      message: "Plagiarism check failed",
      details: err?.response?.data || err.message
    });
  }
});

export default router;
