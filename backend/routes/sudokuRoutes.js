import express from "express";
import SudokuScore from "../models/SudokuScore.js";

const router = express.Router();

function maskEmail(email) {
  if (!email) return "";
  const [user, domain] = email.split("@");
  return user.slice(0, 3) + "***@" + domain;
}

// 🔹 Save score
router.post("/save", async (req, res) => {
  try {
    const { email, nickname, difficulty, time, mistakes } = req.body;

    const score = new SudokuScore({
      email: email || "",
      nickname: nickname || "Unknown",
      difficulty,
      time,
      mistakes
    });

    await score.save();
    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🔹 Load leaderboard
router.get("/leaderboard", async (req, res) => {
  try {
    const difficulty = req.query.difficulty || null;

    const query = difficulty ? { difficulty } : {};

    const scores = await SudokuScore.find(query)
      .sort({ time: 1 })
      .limit(50);

    const safe = scores.map(s => ({
      ...s._doc,
      email: maskEmail(s.email)
    }));

    res.json({ success: true, leaderboard: safe });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
