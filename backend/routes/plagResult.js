import express from "express";
import ApiOrder from "../models/ApiOrder.js";
import { requireApiKey } from "../middleware/requireApiKey.js";

const router = express.Router();


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


      if (!order) {

        return res.status(404).json({
          success: false,
          error: "Order not found"
        });

      }


      return res.json({

        success:
          true,

        order_id:
          order._id,

        status:
          order.status,

        ai_report:
          order.aiReport || null,

        similarity_report:
          order.plagReport || null,

        created_at:
          order.createdAt,

        completed_at:
          order.completedAt || null

      });

    } catch (err) {

      console.error(
        "❌ API RESULT ERROR:",
        err
      );

      return res.status(500).json({
        success: false,
        error: "Failed to get result"
      });

    }

  }
);


export default router;
