import express from "express";
import Order from "../models/Order.js";

const router = express.Router();

router.get("/reports/:email", async (req, res) => {
  try {
    const reports = await Order.find({ email: req.params.email })
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

export default router;
