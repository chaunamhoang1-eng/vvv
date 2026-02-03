import express from "express";
import Order from "../models/Order.js";
import adminAuth from "../middleware/adminAuth.js";
import { create } from "ipfs-http-client";

const router = express.Router();

/* ================= INIT IPFS CLIENT ================= */
const ipfs = create({
  url: "https://ipfs.infura.io:5001/api/v0"
});

/* ================= GET ALL ORDERS ================= */
router.get("/orders", adminAuth, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("ADMIN ORDERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

/* ============================================================
   DOWNLOAD FILE WITH REAL FILENAME
   Frontend will call:
   /api/admin/download/<cid>?name=<filename.ext>
============================================================ */
router.get("/download/:cid", adminAuth, async (req, res) => {
  try {
    const cid = req.params.cid;
    const filename = req.query.name || "document.pdf";

    console.log("DOWNLOADING:", cid, "AS:", filename);

    // Force browser to download & use original filename
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    res.setHeader("Content-Type", "application/octet-stream");

    const stream = ipfs.cat(cid);
    stream.pipe(res);

  } catch (err) {
    console.error("DOWNLOAD ERROR:", err);
    res.status(500).json({ error: "File download failed" });
  }
});

export default router;
