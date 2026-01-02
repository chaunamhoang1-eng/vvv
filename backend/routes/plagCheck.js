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

  try {
    // ✅ run plagiarism check
    const data = await runPlagCheck(file_url);

    // ✅ Deduct credit ONLY on success
    user.credits -= 1;
    user.totalUsed += 1;
    user.lastUsedAt = new Date();
    await user.save();

    // ✅ Send correct response
    res.json({
      success: true,
      task_id: data.taskId,
      credits_left: user.credits,
      ai_score: data.ai_score,
      similarity_score: data.similarity_score,
      outputs: data.outputs
    });

  } catch (err) {
    console.error("PLAG CHECK ERROR:", err);
    res.status(400).json({
      error: err.message,
      details: err.response?.data || null
    });
  }
});

export default router;
