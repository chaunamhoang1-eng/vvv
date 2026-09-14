// routes/plagResult.js
import express from "express";
import ApiOrder from "../models/ApiOrder.js";
import { requireApiKey } from "../middleware/requireApiKey.js";

const router = express.Router();

/**
 * GET /api/v1/plag/result/:id
 *
 * Returns the result for an API user's own order.
 *
 * Authentication:
 * X-API-Key: px_live_xxxxxxxxx
 */
router.get(
  "/result/:id",
  requireApiKey,
  async (req, res) => {
    try {

      const order =
        await ApiOrder.findOne({
          _id: req.params.id,
          apiKey: req.apiUser.apiKey
        });


      /* ==================================================
         ORDER NOT FOUND
      ================================================== */

      if (!order) {

        return res.status(404).json({
          success: false,
          message: "Order not found"
        });

      }


      /* ==================================================
         RESPONSE
      ================================================== */

      return res.json({

        success: true,

        order_id:
          order._id,

        status:
          order.status,

        ai_report:
          order.aiReport || null,

        similarity_report:
          order.plagReport || null

      });


    } catch (err) {

      console.error(
        "❌ API RESULT ERROR:",
        err
      );

      return res.status(500).json({
        success: false,
        message: "Failed to get result"
      });

    }
  }
);


export default router;
