import express from "express";
import axios from "axios";
import Order from "../models/Order.js";
import adminAuth from "../middleware/adminAuth.js";

const router = express.Router();

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

/* ================= DOWNLOAD FILE WITH REAL FILENAME ================= */
router.get("/download/:cid", adminAuth, async (req, res) => {
  try {
    const cid = req.params.cid;
    const filename = req.query.name || "document.pdf";

    if (!cid) {
      return res.status(400).json({ error: "Missing CID" });
    }

    // Use Pinata / IPFS Gateway
    const fileURL = `https://gateway.pinata.cloud/ipfs/${cid}`;

    const response = await axios({
      url: fileURL,
      method: "GET",
      responseType: "stream"
    });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    response.data.pipe(res);

  } catch (err) {
    console.error("DOWNLOAD ERROR:", err);
    res.status(500).json
