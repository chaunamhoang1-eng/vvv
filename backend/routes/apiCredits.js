import express from "express";
import { requireApiKey } from "../middleware/requireApiKey.js";

const router = express.Router();

/**
 * GET /api/plag/credits
 * Returns API user's remaining credits
 */
router.get("/credits", requireApiKey, async (req, res) => {
  const user = req.apiUser;

  return res.json({
    success: true,
    api_key: user.apiKey,
    credits_left: user.credits,
    total_used: user.totalUsed,
    status: user.status,
    last_used_at: user.lastUsedAt
  });
});

export default router;
