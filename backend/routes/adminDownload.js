import express from "express";
import axios from "axios";
import Order from "../models/Order.js";
import ApiOrder from "../models/ApiOrder.js";
import adminAuth from "../middleware/adminAuth.js";

const router = express.Router();

/* ======================================================
   ADMIN DOCUMENT DOWNLOAD

   Supports:
   1. Normal website orders
   2. API orders

   Admin authentication is required.

   The browser does NOT directly access the customer's
   file URL. The backend downloads the file and sends it
   to the admin browser.
====================================================== */

router.get(
  "/download/:orderId",
  adminAuth,
  async (req, res) => {
    try {
      const { orderId } = req.params;

      /* ==================================================
         FIND ORDER
      ================================================== */

      let order = await Order.findById(orderId);

      if (!order) {
        order = await ApiOrder.findById(orderId);
      }

      if (!order) {
        return res.status(404).json({
          success: false,
          error: "Order not found"
        });
      }

      /* ==================================================
         CHECK FILE URL
      ================================================== */

      if (!order.fileURL) {
        return res.status(404).json({
          success: false,
          error: "Document URL not available"
        });
      }

      /* ==================================================
         VALIDATE URL
      ================================================== */

      let sourceURL;

      try {
        sourceURL = new URL(order.fileURL);

        if (
          sourceURL.protocol !== "http:" &&
          sourceURL.protocol !== "https:"
        ) {
          throw new Error("Invalid protocol");
        }
      } catch {
        return res.status(400).json({
          success: false,
          error: "Invalid document URL"
        });
      }

      console.log(
        "📥 ADMIN DOCUMENT DOWNLOAD:",
        orderId
      );

      console.log(
        "🔗 SOURCE:",
        order.fileURL
      );

      /* ==================================================
         DOWNLOAD SOURCE FILE

         arraybuffer is important because the source may
         return DOCX/PDF as application/octet-stream.
      ================================================== */

      const response = await axios.get(
        sourceURL.toString(),
        {
          responseType: "arraybuffer",

          timeout: 60000,

          maxContentLength:
            50 * 1024 * 1024,

          maxBodyLength:
            50 * 1024 * 1024,

          validateStatus: () => true
        }
      );

      /* ==================================================
         CHECK RESPONSE
      ================================================== */

      if (
        response.status < 200 ||
        response.status >= 300
      ) {
        console.error(
          "❌ SOURCE DOWNLOAD FAILED:",
          response.status
        );

        return res.status(502).json({
          success: false,
          error: "Unable to download document"
        });
      }

      /* ==================================================
         CONTENT TYPE
      ================================================== */

      const contentType =
        response.headers["content-type"] ||
        "application/octet-stream";

      res.setHeader(
        "Content-Type",
        contentType
      );

      /* ==================================================
         GET FILENAME

         First try Content-Disposition from source.

         Example:
         filename=Manuscript._副本2.docx
      ================================================== */

      let filename =
        order.filename || "document";

      const disposition =
        response.headers["content-disposition"];

      if (disposition) {
        let match =
          disposition.match(
            /filename\*=UTF-8''([^;]+)/i
          );

        if (match?.[1]) {
          try {
            filename =
              decodeURIComponent(
                match[1].replace(/^"|"$/g, "")
              );
          } catch {
            filename =
              match[1].replace(/^"|"$/g, "");
          }
        } else {
          match =
            disposition.match(
              /filename="?([^";]+)"?/i
            );

          if (match?.[1]) {
            filename =
              match[1].trim();
          }
        }
      }

      /* ==================================================
         CLEAN FILENAME
      ================================================== */

      filename =
        filename
          .replace(/[\r\n]/g, "")
          .trim();

      if (!filename) {
        filename = "document";
      }

      /* ==================================================
         DOWNLOAD HEADER
      ================================================== */

      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      );

      res.setHeader(
        "Content-Length",
        response.data.length
      );

      /* ==================================================
         SEND FILE
      ================================================== */

      return res.send(
        Buffer.from(response.data)
      );

    } catch (err) {
      console.error(
        "❌ ADMIN DOCUMENT DOWNLOAD ERROR:",
        err.message
      );

      return res.status(500).json({
        success: false,
        error: "Failed to download document"
      });
    }
  }
);

export default router;
