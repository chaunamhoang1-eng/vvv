import express from "express";
import fs from "fs";
import path from "path";
import Order from "../models/Order.js";

const router = express.Router();
const uploadDir = path.join(process.cwd(), "uploads");

router.delete("/delete-report/:orderId/:type", async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { orderId, type } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (type === "ai" && order.aiReport?.storedName) {
      const aiPath = path.join(uploadDir, order.aiReport.storedName);
      if (fs.existsSync(aiPath)) fs.unlinkSync(aiPath);
      order.aiReport = undefined;
    }

    if (type === "plag" && order.plagReport?.storedName) {
      const plagPath = path.join(uploadDir, order.plagReport.storedName);
      if (fs.existsSync(plagPath)) fs.unlinkSync(plagPath);
      order.plagReport = undefined;
    }

    // Reset status if any report missing
    order.status = order.aiReport && order.plagReport ? "completed" : "pending";

    await order.save();
    res.json({ message: "Report deleted" });

  } catch (err) {
    console.error("DELETE REPORT ERROR:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

export default router;
