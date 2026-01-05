import express from "express";
import User from "../models/user.js";

const router = express.Router();

// 🔐 bot auth
router.use((req, res, next) => {
  if (req.headers.authorization !== `Bearer ${process.env.BOT_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

router.post("/deduct-credit", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    // 🔒 atomic deduction (prevents double-spend)
    const user = await User.findOneAndUpdate(
      { email, credits: { $gt: 0 } },
      { $inc: { credits: -1 } },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({ error: "No credits left" });
    }

    res.json({
      success: true,
      creditsLeft: user.credits
    });

  } catch (err) {
    console.error("Deduct error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
