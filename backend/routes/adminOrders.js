import express from "express";
import Order from "../models/Order.js";

const router = express.Router();

/* ================= GET ALL ORDERS ================= */
router.get("/orders", async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const orders = await Order.find().sort({ createdAt: -1 });

    // ✅ DO NOT MODIFY OR SAVE HERE
    res.json(orders);

  } catch (err) {
    console.error("ADMIN ORDERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

export default router;
