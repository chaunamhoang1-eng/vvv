import express from "express";
import User from "../models/user.js";

const router = express.Router();

/* GET ACCOUNT INFO */
router.get("/:email", async (req, res) => {
  const user = await User.findOne({ email: req.params.email });

  if (!user) return res.status(404).json({});

  res.json({
    email: user.email,
    credits: user.credits,
    purchasedAt: user.updatedAt
  });
});

/* DELETE ACCOUNT */
router.delete("/:email", async (req, res) => {
  await User.deleteOne({ email: req.params.email });
  res.json({ success: true });
});

export default router;
