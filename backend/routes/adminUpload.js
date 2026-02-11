import express from "express";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";

import { PDFDocument, rgb } from "pdf-lib";

import Order from "../models/Order.js";
import User from "../models/user.js";
import AdminActivity from "../models/AdminActivity.js";
import adminAuth from "../middleware/adminAuth.js";

import { updateDiscordOrder } from "../utils/discordWebhook.js";

const router = express.Router();

/* ================= MULTER MEMORY ================= */
const upload = multer({ storage: multer.memoryStorage() });

/* ======================================================
   CLEAN TURNITIN PDF (remove submission ID block)
====================================================== */
async function cleanTurnitinPDF(buffer) {
  const pdf = await PDFDocument.load(buffer);
  const pages = pdf.getPages();

  pages.forEach((page, index) => {
    const { width, height } = page.getSize();

    /* --------------------------------------------------------
       1️⃣ HALF-SIZE TOP HEADER CLEANING (ALL PAGES)
       -------------------------------------------------------- */
    page.drawRectangle({
      x: 0,
      y: height - 60,   // reduced from 120 → 60
      width: width,
      height: 60,       // reduced from 120 → 60
      color: rgb(1, 1, 1),
    });

    /* --------------------------------------------------------
       2️⃣ HALF-SIZE FOOTER CLEANING (ALL PAGES)
       -------------------------------------------------------- */
    page.drawRectangle({
      x: width - 220,
      y: 0,
      width: 220,
      height: 15,        // reduced from 30 → 15
      color: rgb(1, 1, 1),
    });

    /* --------------------------------------------------------
       3️⃣ PAGE 1 — HALF-SIZE DOCUMENT DETAILS BLOCK
       -------------------------------------------------------- */
    if (index === 0) {

      // Left-side "Document Details" section
      page.drawRectangle({
        x: 0,
        y: height - 500,
        width: width / 2,
        height: 210,      // reduced from 420 → 210
        color: rgb(1, 1, 1),
      });

      // Right-side "12 pages / 2464 words / characters" box
      page.drawRectangle({
        x: width / 2,
        y: height - 330,
        width: width / 2,
        height: 150,      // reduced from 300 → 150
        color: rgb(1, 1, 1),
      });
    }
  });

  return await pdf.save();
}

/* ======================================================
   UPLOAD CLEANED PDF TO PINATA
====================================================== */
async function uploadToPinata(file) {
  let finalBuffer = file.buffer;

  // Clean only PDFs
  if (file.mimetype === "application/pdf") {
    try {
      const cleaned = await cleanTurnitinPDF(file.buffer);
      finalBuffer = Buffer.from(cleaned); // IMPORTANT FIX
    } catch (err) {
      console.log("⚠️ PDF cleaning failed:", err.message);
    }
  }

  const fd = new FormData();

  // MUST be Buffer, NOT Uint8Array
  fd.append("file", Buffer.from(finalBuffer), {
    filename: file.originalname,
    contentType: file.mimetype,
  });

  const res = await axios.post(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    fd,
    {
      maxBodyLength: Infinity,
      headers: {
        ...fd.getHeaders(),
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
    }
  );

  return `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`;
}

/* ======================================================
   ADMIN UPLOAD REPORT → COMPLETE ORDER
====================================================== */
router.post(
  "/upload-report",
  adminAuth,
  upload.fields([
    { name: "aiReport", maxCount: 1 },
    { name: "plagReport", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const adminName = req.admin.username;
      const { orderId } = req.body;

      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });

      /* ===== AI REPORT ===== */
      if (req.files?.aiReport?.[0]) {
        const aiFile = req.files.aiReport[0];
        const aiURL = await uploadToPinata(aiFile);

        order.aiReport = {
          filename: aiFile.originalname,
          storedName: aiURL,
        };

        await AdminActivity.create({ adminId: req.admin.id, orderId, type: "ai" });
      }

      /* ===== PLAG REPORT ===== */
      if (req.files?.plagReport?.[0]) {
        const plagFile = req.files.plagReport[0];
        const plagURL = await uploadToPinata(plagFile);

        order.plagReport = {
          filename: plagFile.originalname,
          storedName: plagURL,
        };

        await AdminActivity.create({ adminId: req.admin.id, orderId, type: "plag" });
      }

      /* ===== STATUS ===== */
      order.status =
        order.aiReport?.storedName && order.plagReport?.storedName
          ? "completed"
          : "pending";

      if (order.status === "completed") {
        order.completedBy = adminName;
        order.completedAt = new Date();
      }

      await order.save();

      /* ===== CREDIT DEDUCTION ONCE ===== */
      if (order.status === "completed") {
        const lock = await Order.findOneAndUpdate(
          { _id: orderId, creditDeducted: false },
          { creditDeducted: true }
        );

        if (lock) {
          await User.updateOne(
            { email: lock.email },
            {
              $inc: { credits: -1, totalUsed: 1 },
              $set: { lastUsedAt: new Date() },
            }
          );
        }
      }

      /* ===== UPDATE DISCORD MESSAGE ===== */
      try {
        if (order.discord_messages?.length > 0) {
          await updateDiscordOrder(order, order.discord_messages);
          console.log("🔄 Discord updated for:", orderId);
        }
      } catch (err) {
        console.error("❌ Discord update error:", err);
      }

      return res.json({ success: true });
    } catch (err) {
      console.error("ADMIN UPLOAD ERROR:", err);
      return res.status(500).json({ error: "Failed to upload reports" });
    }
  }
);

export default router;
