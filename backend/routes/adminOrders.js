import express from "express";

import Order from "../models/Order.js";
import ApiOrder from "../models/ApiOrder.js";

import adminAuth from "../middleware/adminAuth.js";

const router = express.Router();

/* ======================================================
   GET ALL ORDERS

   RETURNS:
   1. NORMAL WEBSITE ORDERS
      → Order

   2. PUBLIC API ORDERS
      → ApiOrder

   EXISTING DASHBOARD CAN CONTINUE
   USING THE SAME /api/admin/orders ENDPOINT.
====================================================== */

router.get("/orders", adminAuth, async (req, res) => {
  try {
    /* ==================================================
       WEBSITE ORDERS
    ================================================== */

    const websiteOrders = await Order.find()
      .lean();

    /* ==================================================
       API ORDERS
    ================================================== */

    const apiOrders = await ApiOrder.find()
      .lean();

    /* ==================================================
       ADD ORDER TYPE

       This does NOT remove or change existing fields.
    ================================================== */

    const formattedWebsiteOrders =
      websiteOrders.map((order) => ({
        ...order,
        orderType: "website"
      }));

    const formattedApiOrders =
      apiOrders.map((order) => ({
        ...order,
        orderType: "api"
      }));

    /* ==================================================
       COMBINE BOTH
    ================================================== */

    const orders = [
      ...formattedWebsiteOrders,
      ...formattedApiOrders
    ];

    /* ==================================================
       SORT NEWEST FIRST
    ================================================== */

    orders.sort((a, b) => {
      const dateA =
        new Date(a.createdAt || 0).getTime();

      const dateB =
        new Date(b.createdAt || 0).getTime();

      return dateB - dateA;
    });

    console.log(
      "📋 ADMIN ORDERS:",
      {
        websiteOrders: websiteOrders.length,
        apiOrders: apiOrders.length,
        total: orders.length
      }
    );

    return res.json(orders);

  } catch (err) {
    console.error(
      "ADMIN ORDERS ERROR:",
      err
    );

    return res.status(500).json({
      error: "Failed to fetch orders"
    });
  }
});


/* ======================================================
   DELETE SINGLE ORDER

   Supports:
   - Website Order
   - API Order
====================================================== */

router.delete(
  "/order/:id",
  adminAuth,
  async (req, res) => {
    try {
      const { id } = req.params;

      /* ----------------------------------------------
         FIRST: WEBSITE ORDER
      ---------------------------------------------- */

      let deleted =
        await Order.findByIdAndDelete(id);

      let orderType = "website";

      /* ----------------------------------------------
         IF NOT WEBSITE ORDER:
         TRY API ORDER
      ---------------------------------------------- */

      if (!deleted) {
        deleted =
          await ApiOrder.findByIdAndDelete(id);

        orderType = "api";
      }

      /* ----------------------------------------------
         NOT FOUND
      ---------------------------------------------- */

      if (!deleted) {
        return res.status(404).json({
          error: "Order not found"
        });
      }

      console.log(
        "🗑️ ORDER DELETED:",
        id,
        orderType
      );

      return res.json({
        success: true,
        message: "Order deleted successfully",
        deletedOrderId: id,
        orderType
      });

    } catch (err) {
      console.error(
        "DELETE ORDER ERROR:",
        err
      );

      return res.status(500).json({
        error: "Failed to delete order"
      });
    }
  }
);


/* ======================================================
   DELETE MULTIPLE ORDERS

   Supports:
   - Website Orders
   - API Orders
====================================================== */

router.post(
  "/orders/multi-delete",
  adminAuth,
  async (req, res) => {
    try {
      const { ids } = req.body;

      if (
        !ids ||
        !Array.isArray(ids) ||
        ids.length === 0
      ) {
        return res.status(400).json({
          error: "No IDs provided"
        });
      }

      /* ----------------------------------------------
         DELETE FROM WEBSITE ORDERS
      ---------------------------------------------- */

      const websiteResult =
        await Order.deleteMany({
          _id: {
            $in: ids
          }
        });

      /* ----------------------------------------------
         DELETE FROM API ORDERS
      ---------------------------------------------- */

      const apiResult =
        await ApiOrder.deleteMany({
          _id: {
            $in: ids
          }
        });

      const deletedCount =
        (websiteResult.deletedCount || 0) +
        (apiResult.deletedCount || 0);

      console.log(
        "🗑️ MULTI DELETE:",
        {
          requested: ids.length,
          websiteDeleted:
            websiteResult.deletedCount || 0,
          apiDeleted:
            apiResult.deletedCount || 0,
          totalDeleted:
            deletedCount
        }
      );

      return res.json({
        success: true,
        deleted: deletedCount,
        message: `${deletedCount} orders deleted`
      });

    } catch (err) {
      console.error(
        "MULTI DELETE ERROR:",
        err
      );

      return res.status(500).json({
        error: "Failed to delete selected orders"
      });
    }
  }
);


export default router;
