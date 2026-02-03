import express from "express";
import axios from "axios";
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

    // Use any gateway (Pinata, IPFS, Infura, Dweb)
    const fileURL = `https://gateway.pinata.cloud/ipfs/${cid}`;

    // Stream file from gateway
    const response = await axios({
      url: fileURL,
      method: "GET",
      responseType: "stream"
    });

    // Set filename for browser
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    response.data.pipe(res);

  } catch (err) {
    console.error("DOWNLOAD ERROR:", err);
    res.status(500).json({ error: "Download failed" });
  }
});

export default router;
