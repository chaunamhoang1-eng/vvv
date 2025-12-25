import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import FormData from "form-data";
import Order from "../models/Order.js";

const router = express.Router();

/* ================= PATH ================= */
const uploadDir = path.join(process.cwd(), "uploads");

/* ================= ENSURE UPLOAD FOLDER ================= */
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/* ================= MULTER CONFIG ================= */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({ storage });

/* ======================================================
   USER UPLOAD → SAVE → DISCORD → DB
====================================================== */
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    console.log("➡️ Upload request received");

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("📧 Email:", email);
    console.log("📄 File:", req.file.originalname);
    console.log("📁 Stored as:", req.file.filename);

    /* ================= SAVE ORDER ================= */
    const order = await Order.create({
      email,
      filename: req.file.originalname,
      storedName: req.file.filename,
      status: "pending"
    });

    /* ================= DISCORD WEBHOOK ================= */
    try {
      const webhookURL =
        "https://discord.com/api/webhooks/1453630484499271862/3N3qoF0c4yvuRCSZg8TxzRgRnKoWwZuxWP7ZjU6Hn9oewwpOID92dXNPyhRP53CP5Fc4";

      const form = new FormData();
      form.append(
        "content",
        `📥 **New Order Received**\n📧 ${email}\n📄 ${req.file.originalname}\n🔴 Status: Pending`
      );
      form.append("file", fs.createReadStream(req.file.path));

      await fetch(webhookURL, {
        method: "POST",
        body: form,
        headers: form.getHeaders()
      });

      console.log("✅ File sent to Discord");
    } catch (err) {
      console.error("❌ Discord webhook failed:", err.message);
    }

    /* ================= RESPONSE ================= */
    res.json({
      id: order._id,
      filename: order.filename,
      storedName: order.storedName,
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
   DELETE FILE (BACKEND + DB)
====================================================== */
router.delete("/delete/:storedName", async (req, res) => {
  try {
    const filePath = path.join(uploadDir, req.params.storedName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await Order.deleteOne({ storedName: req.params.storedName });

    console.log("🗑️ Deleted:", req.params.storedName);

    res.json({ message: "File deleted successfully" });

  } catch (err) {
    console.error("🔥 DELETE ERROR:", err);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

export default router;
