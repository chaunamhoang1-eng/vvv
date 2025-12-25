import express from "express";
import multer from "multer";
import path from "path";
import Order from "../models/Order.js";
import AdminActivity from "../models/AdminActivity.js";

const router = express.Router();
const uploadDir = path.join(process.cwd(), "uploads");
const upload = multer({ dest: uploadDir });

router.post(
  "/upload-report",
  upload.fields([
    { name: "aiReport", maxCount: 1 },
    { name: "plagReport", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      if (!req.session.admin) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { orderId } = req.body;
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // AI upload
      if (req.files?.aiReport?.length) {
        order.aiReport = {
          filename: req.files.aiReport[0].originalname,
          storedName: req.files.aiReport[0].filename
        };
      }

      // Plag upload
      if (req.files?.plagReport?.length) {
        order.plagReport = {
          filename: req.files.plagReport[0].originalname,
          storedName: req.files.plagReport[0].filename
        };
      }

      // ✅ FINAL STATUS RULE
      if (order.aiReport?.storedName && order.plagReport?.storedName) {
        order.status = "completed";
      } else {
        order.status = "pending";
      }

      await order.save();

      res.json({ message: "Upload successful" });

    } catch (err) {
      console.error("ADMIN UPLOAD ERROR:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);


export default router;
