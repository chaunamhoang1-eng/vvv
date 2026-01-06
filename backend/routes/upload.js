import express from "express";
import axios from "axios";
import FormData from "form-data";
import multer from "multer";

import Order from "../models/Order.js";
import User from "../models/user.js";

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
  res.json({ ok: true });
});

/* ======================================================
   USER UPLOAD → CHECK CREDIT → PINATA → SAVE ORDER
   (NO CREDIT DEDUCTION HERE)
   (NO PROCESSING HERE)
====================================================== */
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { email } = req.body;
    const file = req.file;

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

    /* ================= IPFS DATA ================= */
    const ipfsHash = pinataRes.data.IpfsHash;
    const fileURL = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

    /* ================= SAVE ORDER (QUEUE ITEM) ================= */
    const order = await Order.create({
      email,
      filename: file.originalname,
      storedName: ipfsHash,
      fileURL,
      status: "pending",
      processing: false,
      retryCount: 0,
      creditDeducted: false
    });

    /* ================= RESPONSE ================= */
    res.json({
      success: true,
      orderId: order._id,
      filename: order.filename,
      fileURL,
      message: "File uploaded. Processing started."
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
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete order" });
  }
});

export default router;
