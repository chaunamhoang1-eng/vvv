import express from "express";
import axios from "axios";
import FormData from "form-data";
import multer from "multer";

import Order from "../models/Order.js";
import User from "../models/user.js";
import { processDocument } from "../services/processor.js"; // ✅ AUTO API

console.log("✅ upload.js loaded");

const router = express.Router();

/* ================= MULTER (MEMORY) ================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
});

/* ================= TEST ROUTE ================= */
router.get("/upload-test", (req, res) => {
  console.log("✅ upload-test hit");
  res.json({ ok: true });
});

/* ======================================================
   USER UPLOAD → CREDIT CHECK → PINATA → SAVE → AUTO API
====================================================== */
router.post("/upload", upload.single("file"), async (req, res) => {
  console.log("🚨 /upload ROUTE HIT");

  try {
    const { email } = req.body;
    const file = req.file;

    console.log("REQ BODY:", req.body);
    console.log("REQ FILE:", file);
    console.log("🔑 PINATA_JWT exists:", !!process.env.PINATA_JWT);

    /* ================= VALIDATION ================= */
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!file) {
      return res.status(400).json({
        error: "File missing",
        hint: "Check input name='file' and enctype='multipart/form-data'"
      });
    }

    /* ================= CHECK USER ================= */
    const user = await User.findOne({ email });

    if (!user || !user.hasPurchased || user.credits <= 0) {
      return res.status(403).json({
        error: "No credits available. Please purchase a plan."
      });
    }

    console.log("💳 Credits before:", user.credits);

    /* ================= UPLOAD TO PINATA ================= */
    const pinataForm = new FormData();

    pinataForm.append("file", file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype
    });

    pinataForm.append(
      "pinataMetadata",
      JSON.stringify({
        name: file.originalname,
        keyvalues: {
          uploadedBy: email,
          app: "PlagX"
        }
      })
    );

    pinataForm.append(
      "pinataOptions",
      JSON.stringify({ cidVersion: 1 })
    );

    console.log("🚀 Uploading to Pinata...");

    const pinataRes = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      pinataForm,
      {
        maxBodyLength: Infinity,
        headers: {
          ...pinataForm.getHeaders(),
          Authorization: `Bearer ${process.env.PINATA_JWT}`
        }
      }
    );

    console.log("✅ Pinata SUCCESS:", pinataRes.data);

    /* ================= IPFS DATA ================= */
    const ipfsHash = pinataRes.data.IpfsHash;
    const fileURL = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
    const storedName = ipfsHash;

    console.log("🌐 IPFS URL:", fileURL);

    /* ================= SAVE ORDER ================= */
    const order = await Order.create({
      email,
      filename: file.originalname,
      storedName,
      fileURL,
      status: "pending"
    });

    /* ================= AUTO API PROCESS (NON-BLOCKING) ================= */
    processDocument(order._id, fileURL); // 🔥 API first, manual fallback

    /* ================= DEDUCT CREDIT ================= */
    await User.updateOne(
      { email },
      { $inc: { credits: -1 } }
    );

    console.log("💳 Credit deducted (-1)");

    /* ================= RESPONSE ================= */
    res.json({
      success: true,
      orderId: order._id,
      filename: order.filename,
      fileURL,
      date: order.createdAt
    });

  } catch (err) {
    console.error("🔥 UPLOAD ERROR:", err);
    res.status(500).json({
      error: "Server error during upload",
      details: err.message
    });
  }
});

/* ======================================================
   DELETE ORDER (DB ONLY)
====================================================== */
router.delete("/delete/:id", async (req, res) => {
  console.log("🗑️ Delete route hit:", req.params.id);

  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("🔥 DELETE ERROR:", err);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

export default router;
