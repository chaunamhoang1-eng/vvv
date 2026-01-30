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
  limits: { fileSize: 20 * 1024 * 1024 }
});

/* ================= TEST ROUTE ================= */
router.get("/upload-test", (_, res) => {
  res.json({ ok: true });
});

/* ======================================================
   POST /api/upload — USER UPLOAD
====================================================== */
router.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.firebaseUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const file = req.file;
      const { uid, email } = req.firebaseUser;

      if (!file) {
        return res.status(400).json({
          error: "File missing",
          hint: "Check input name='file'"
        });
      }

      let user = await User.findOne({ firebaseUid: uid });

      if (!user && email) {
        user = await User.findOne({ email });

        if (user && !user.firebaseUid) {
          user.firebaseUid = uid;
          await user.save();
          console.log("Auto-linked user:", email);
        }
      }

      if (!user || !user.hasPurchased || user.credits <= 0) {
        return res.status(403).json({ error: "No credits available" });
      }

      /* ===== Upload to Pinata ===== */
      const form = new FormData();
      form.append("file", file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });

      form.append(
        "pinataMetadata",
        JSON.stringify({ name: file.originalname })
      );

      const pinataRes = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        form,
        {
          maxBodyLength: Infinity,
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${process.env.PINATA_JWT}`
          }
        }
      );

      const ipfs = pinataRes.data.IpfsHash;
      const fileURL = `https://gateway.pinata.cloud/ipfs/${ipfs}`;

      /* ===== Save Order in DB ===== */
      const order = await Order.create({
        firebaseUid: uid,
        email,
        filename: file.originalname,
        storedName: ipfs,
        fileURL,
        status: "pending"
      });

      /* ===== Send Discord Embed (save messageId) ===== */
      try {
        const discordMsg = await sendOrderToDiscord(order);

        if (discordMsg) {
          order.discord_messages = discordMsg;
          await order.save();
        }

        console.log("📨 Webhook sent & stored.");
      } catch (err) {
        console.error("❌ Discord send failed:", err);
      }

      return res.json({
        success: true,
        orderId: order._id,
        fileURL,
        message: "File uploaded successfully."
      });

    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      return res.status(500).json({ error: "Server error", details: err.message });
    }
  }
);

export default router;
