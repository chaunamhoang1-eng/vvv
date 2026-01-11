
import express from "express";
import { requireApiKey } from "../middleware/requireApiKey.js";
import { runPlagCheck } from "../services/externalCheck.js";

const router = express.Router();

router.post("/check", requireApiKey, async (req, res) => {
  const user = req.apiUser;
  const { file_url } = req.body;

  if (!file_url) {
    return res.status(400).json({ error: "file_url required" });
  }

  // 🔒 Block inactive API users
  if (user.status !== "active") {
    return res.status(403).json({
      success: false,
      message: "API key is blocked"
    });
  }

  // 🔑 Ensure activation code exists
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
  const data = await runPlagCheck(file_url, user.activationCode);

  // ✅ Credit deducted ONLY after full completion
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
  // ❌ No credit deduction here
  return res.status(400).json({
    success: false,
    message: err.message || "Plagiarism check failed"
  });
}

});

export default router;
