import express from "express";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";

import Order from "../models/Order.js";
import User from "../models/user.js"; // ✅ ADD
import AdminActivity from "../models/AdminActivity.js";
import adminAuth from "../middleware/adminAuth.js";

const router = express.Router();

/* ================= MULTER (MEMORY) ================= */
const upload = multer({
  storage: multer.memoryStorage()
});

/* ================= PINATA HELPER ================= */
async function uploadToPinata(file) {
  const fd = new FormData();

  fd.append("file", file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype
  });

  const res = await axios.post(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    fd,
    {
      maxBodyLength: Infinity,
      headers: {
        ...fd.getHeaders(),
        Authorization: `Bearer ${process.env.PINATA_JWT}`
      }
    }
  );

  return `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`;
}

/* ======================================================
   ADMIN UPLOAD → PINATA → SAVE → ACTIVITY LOG
====================================================== */
router.post(
  "/upload-report",
  adminAuth,
  upload.fields([
    { name: "aiReport", maxCount: 1 },
    { name: "plagReport", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const adminId = req.admin.id;
      const { orderId } = req.body;

      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      /* ================= AI REPORT ================= */
      if (req.files?.aiReport?.[0]) {
        const aiFile = req.files.aiReport[0];
        const aiURL = await uploadToPinata(aiFile);

        order.aiReport = {
          filename: aiFile.originalname,
          storedName: aiURL
        };

        await AdminActivity.create({
          adminId,
          orderId: order._id,
          type: "ai"
        });
      }

      /* ================= PLAG REPORT ================= */
      if (req.files?.plagReport?.[0]) {
        const plagFile = req.files.plagReport[0];
        const plagURL = await uploadToPinata(plagFile);

        order.plagReport = {
          filename: plagFile.originalname,
          storedName: plagURL
        };

        await AdminActivity.create({
          adminId,
          orderId: order._id,
          type: "plag"
        });
      }

      /* ================= STATUS ================= */
      order.status =
        order.aiReport?.storedName && order.plagReport?.storedName
          ? "completed"
          : "pending";

      await order.save();

      /* ================= 💳 CREDIT DEDUCTION (ONCE) ================= */
      if (order.status === "completed") {
        const lock = await Order.findOneAndUpdate(
          { _id: orderId, creditDeducted: false },
          { creditDeducted: true },
          { new: true }
        );

        if (lock) {
          await User.updateOne(
            { email: lock.email },
            {
              $inc: { credits: -1
