import express from "express";
import Order from "../models/Order.js";
import { requireApiKey } from "../middleware/requireApiKey.js";

const router = express.Router();

router.post("/check", requireApiKey, async (req, res) => {
  const { file_url } = req.body;

  if (!file_url) {
    return res.status(400).json({ error: "file_url required" });
  }

  const apiUser = req.apiUser;

  const order = await Order.create({
    apiUserId: apiUser._id,
    email: apiUser.email,
    fileURL: file_url,
    status: "pending"
  });

  res.json({
    request_id: order._id,
    status: "processing"
  });
});

router.get("/status/:id", requireApiKey, async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.id,
    apiUserId: req.apiUser._id
  });

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  res.json({
    status: order.status,
    ai: order.aiReport || null,
    plagiarism: order.plagReport || null
  });
});

export default router;
