// routes/validateEmail.js
import express from "express";
import User from "../models/user.js";

const router = express.Router();

// 🔐 simple bot auth
router.use((req, res, next) => {
  if (req.headers.authorization !== `Bearer ${process.env.BOT_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized bot" });
  }
  next();
});

router.post("/validate-email", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ valid: false, credits: 0 });
    }

    return res.json({
      valid: true,
      credits: user.credits
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
