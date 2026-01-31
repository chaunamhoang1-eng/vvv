import express from "express"; 
import SudokuScore from "../models/SudokuScore.js";
import firebaseAuth from "../middleware/firebaseAuth.js";

const router = express.Router();

// Mask email
function maskEmail(email) {
  if (!email) return "";
  const [user, domain] = email.split("@");
  return user.slice(0, 3) + "***@" + domain;
}

// ⭐ Corrected: this must match frontend
router.post("/submit", firebaseAuth, async (req, res) => {
  try {
    const { nickname, difficulty, time, mistakes } = req.body;

    const score = new SudokuScore({
      email: req.firebaseUser.email || "unknown",
      nickname,
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

// ⭐ Leaderboard
router.get("/leaderboard", firebaseAuth, async (req, res) => {
  try {
    const { difficulty } = req.query;

    const scores = await SudokuScore.find(
      difficulty ? { difficulty } : {}
    )
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
