import express from "express";
import Order from "../models/Order.js";
import adminAuth from "../middleware/adminAuth.js";

const router = express.Router();

/* ================================
   GET ALL ORDERS
================================ */
router.get("/orders", adminAuth, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("ADMIN ORDERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

/* ================================
   DELETE SINGLE ORDER
================================ */
router.delete("/order/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Order.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      success: true,
      message: "Order deleted successfully",
      deletedOrderId: id
    });

  } catch (err) {
    console.error("DELETE ORDER ERROR:", err);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

/* ================================
   DELETE MULTIPLE ORDERS
================================ */
router.post("/orders/multi-delete", adminAuth, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No IDs provided" });
    }

    await Order.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      deleted: ids.length,
      message: `${ids.length} orders deleted`
    });

  } catch (err) {
    console.error("MULTI DELETE ERROR:", err);
    res.status(500).json({ error: "Failed to delete selected orders" });
  }
});

export default router;
