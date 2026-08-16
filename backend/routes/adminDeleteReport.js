import express from "express";
import Order from "../models/Order.js";
import adminAuth from "../middleware/adminAuth.js";
import firebaseAuth from "../middleware/firebaseAuth.js";

const router = express.Router();


/* ======================================================
   USER DELETE
   DELETE /api/admin/delete-report/:orderId

   Used by normal user dashboard.

   Firebase authentication is required.
   User can delete ONLY their own order.
====================================================== */

router.delete(
  "/delete-report/:orderId",
  firebaseAuth,
  async (req, res) => {

    try {

      const { orderId } = req.params;

      /* ================================================
         FIREBASE USER
      ================================================ */

      if (!req.firebaseUser) {

        return res.status(401).json({
          error: "Unauthorized"
        });

      }

      const {
        uid,
        email
      } = req.firebaseUser;


      /* ================================================
         FIND ORDER
      ================================================ */

      const order =
        await Order.findById(orderId);


      if (!order) {

        return res.status(404).json({
          error: "Order not found"
        });

      }


      /* ================================================
         OWNERSHIP CHECK

         Support both:
         - firebaseUid
         - old email-based orders
      ================================================ */

      const ownsOrder =
        (
          order.firebaseUid &&
          order.firebaseUid === uid
        )
        ||
        (
          order.email &&
          email &&
          order.email.toLowerCase() ===
          email.toLowerCase()
        );


      if (!ownsOrder) {

        return res.status(403).json({
          error: "You are not allowed to delete this order"
        });

      }


      /* ================================================
         DELETE ORDER
      ================================================ */

      await Order.findByIdAndDelete(
        orderId
      );


      console.log(
        `🗑️ USER DELETED ORDER: ${orderId}`
      );


      return res.json({
        success: true,
        message: "Report deleted successfully"
      });


    } catch (err) {

      console.error(
        "❌ USER DELETE REPORT ERROR:",
        err
      );

      return res.status(500).json({
        error: "Delete failed"
      });

    }

  }
);


/* ======================================================
   ADMIN DELETE INDIVIDUAL REPORT
   DELETE /api/admin/delete-report/:orderId/:type

   type = ai | plag

   KEEPING YOUR EXISTING ADMIN FUNCTIONALITY
====================================================== */

router.delete(
  "/delete-report/:orderId/:type",
  adminAuth,
  async (req, res) => {

    try {

      const {
        orderId,
        type
      } = req.params;


      /* ================================================
         VALIDATE TYPE
      ================================================ */

      if (
        type !== "ai" &&
        type !== "plag"
      ) {

        return res.status(400).json({
          error: "Invalid report type"
        });

      }


      /* ================================================
         FIND ORDER
      ================================================ */

      const order =
        await Order.findById(orderId);


      if (!order) {

        return res.status(404).json({
          error: "Order not found"
        });

      }


      /* ================================================
         REMOVE REPORT
      ================================================ */

      if (type === "ai") {

        order.aiReport = undefined;

      }


      if (type === "plag") {

        order.plagReport = undefined;

      }


      /* ================================================
         UPDATE STATUS
      ================================================ */

      order.status =
        order.aiReport?.storedName &&
        order.plagReport?.storedName
          ? "completed"
          : "pending";


      await order.save();


      return res.json({
        success: true,
        message: "Report deleted successfully"
      });


    } catch (err) {

      console.error(
        "❌ ADMIN DELETE REPORT ERROR:",
        err
      );

      return res.status(500).json({
        error: "Delete failed"
      });

    }

  }
);


export default router;
