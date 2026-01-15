import express from "express";
import axios from "axios";
import FormData from "form-data";
import multer from "multer";
import { sendOrderToDiscord } from "../utils/discordWebhook.js";

import Order from "../models/Order.js";
import User from "../models/user.js";

console.log("✅ upload.js loaded");

const router = express.Router();

/* ================= MULTER (MEMORY STORAGE) ================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
});

/* ================= TEST ROUTE ================= */
router.get("/upload-test", (_, res) => {
  res.json({ ok: true });
});

/* ======================================================
   POST /api/upload
   - Firebase auth already applied in server.js
   - Backward compatible (old + new users)
====================================================== */
router.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      /* ================= AUTH SAFETY ================= */
      if (!req.firebaseUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const file = req.file;
      const { uid, email } = req.firebaseUser;

      /* ================= FILE VALIDATION ================= */
      if (!file) {
        return res.status(400).json({
          error: "File missing",
          hint: "Check input name='file' and enctype='multipart/form-data'"
        });
      }

      /* ================= USER LOOKUP ================= */
      let user = await User.findOne({ firebaseUid: uid });

      // 🔁 Fallback for old email-based users
      if (!user && email) {
        user = await User.findOne({ email });
        if (user && !user.firebaseUid) {
          user.firebaseUid = uid;
          await user.save();
          console.log("✅ Auto-linked user to firebaseUid:", email);
        }
      }

      if (!user || !user.hasPurchased || user.credits <= 0) {
        return res.status(403).json({
          error: "No credits available. Please purchase a plan."
        });
      }

      /* ================= PINATA UPLOAD ================= */
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
            uploadedBy: email || "firebase-user",
            firebaseUid: uid,
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

      /* ================= SAVE ORDER ================= */
      const order = await Order.create({
        firebaseUid: uid,
        email: email || null,
        filename: file.originalname,
        storedName: ipfsHash,
        fileURL,
        status: "pending",
        processing: false,
        retryCount: 0,
        creditDeducted: false
      });

      // 🔔 DISCORD (NON-BLOCKING)
      sendOrderToDiscord(order);

      /* ================= RESPONSE ================= */
      return res.json({
        success: true,
        orderId: order._id,
        filename: order.filename,
        fileURL,
        message: "File uploaded. Processing started."
      });

    } catch (err) {
      console.error("🔥 UPLOAD ERROR:", err);
      return res.status(500).json({
        error: "Server error during upload",
        details: err.message
      });
    }
  }
);

/* ======================================================
   DELETE /api/delete/:id
   - Owner only
====================================================== */
router.delete("/delete/:id", async (req, res) => {
  try {
    if (!req.firebaseUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { uid } = req.firebaseUser;

    const order = await Order.findOne({
      _id: req.params.id,
      firebaseUid: uid
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    await order.deleteOne();

    return res.json({ message: "Order deleted successfully" });

  } catch (err) {
    console.error("❌ DELETE ERROR:", err);
    return res.status(500).json({ error: "Failed to delete order" });
  }
});

export default router;
