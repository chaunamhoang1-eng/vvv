import express from "express";
import SudokuScore from "../models/SudokuScore.js";

const router = express.Router();

// Masking email before sending to frontend
function maskEmail(email) {
  if (!email) return "hidden@example.com";
  const [user, domain] = email.split("@");
  const maskedUser = user.slice(0, 3) + "***";
  return `${maskedUser}@${domain}`;
}

// Save score
router.post("/save", async (req, res) => {
  try {
    const { email, nickname, difficulty, time, mistakes } = req.body;

    if (!nickname || nickname.trim() === "") {
      return res.status(400).json({ success: false, error: "Nickname required" });
    }

    const newScore = new SudokuScore({
      email,
      nickname,
      difficulty,
      time,
      mistakes
    });

    await newScore.save();

    res.json({ success: true, message: "Score saved" });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Leaderboard
router.get("/leaderboard", async (req, res) => {
  try {
    const { difficulty } = req.query;

    const scores = await SudokuScore.find({ difficulty })
      .sort({ time: 1 })
      .limit(50);

    const safeScores = scores.map(s => ({
      ...s._doc,
      email: maskEmail(s.email)  // Masked here
    }));

    res.json({ success: true, leaderboard: safeScores });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
