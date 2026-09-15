import express from "express";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";

import { PDFDocument, rgb } from "pdf-lib";

import Order from "../models/Order.js";
import ApiOrder from "../models/ApiOrder.js";
import AdminActivity from "../models/AdminActivity.js";
import adminAuth from "../middleware/adminAuth.js";

import { updateDiscordOrder } from "../utils/discordWebhook.js";

const router = express.Router();

/* ================= MULTER MEMORY ================= */

const upload = multer({
  storage: multer.memoryStorage()
});


/* ======================================================
   CLEAN TURNITIN PDF
====================================================== */

async function cleanTurnitinPDF(buffer) {

  const pdf =
    await PDFDocument.load(buffer);

  const pages =
    pdf.getPages();

  pages.forEach(
    (page, pageIndex) => {

      const {
        width,
        height
      } =
        page.getSize();


      /* REMOVE TOP-RIGHT SUBMISSION ID */

      page.drawRectangle({

        x:
          width - 260,

        y:
          height - 85,

        width:
          260,

        height:
          85,

        color:
          rgb(1, 1, 1)

      });


      /* REMOVE BOTTOM-RIGHT SUBMISSION ID */

      page.drawRectangle({

        x:
          width - 290,

        y:
          30,

        width:
          3000,

        height:
          30,

        color:
          rgb(1, 1, 1)

      });


      /* PAGE 1 CLEANING */

      if (pageIndex === 0) {

        /* LEFT DOCUMENT DETAILS */

        page.drawRectangle({

          x:
            0,

          y:
            height - 580,

          width:
            340,

          height:
            520,

          color:
            rgb(1, 1, 1)

        });


        /* RIGHT STATS BOX */

        page.drawRectangle({

          x:
            width - 260,

          y:
            height - 330,

          width:
            260,

          height:
            250,

          color:
            rgb(1, 1, 1)

        });

      }

    }
  );

  return await pdf.save();

}


/* ======================================================
   UPLOAD CLEANED PDF TO PINATA
====================================================== */

async function uploadToPinata(file) {

  let finalBuffer =
    file.buffer;


  /* CLEAN PDF */

  if (
    file.mimetype ===
    "application/pdf"
  ) {

    try {

      const cleaned =
        await cleanTurnitinPDF(
          file.buffer
        );

      finalBuffer =
        Buffer.from(cleaned);

    } catch (err) {

      console.log(
        "⚠️ PDF cleaning failed:",
        err.message
      );

    }

  }


  const fd =
    new FormData();


  fd.append(
    "file",
    Buffer.from(finalBuffer),
    {
      filename:
        file.originalname,

      contentType:
        file.mimetype
    }
  );


  const res =
    await axios.post(

      "https://api.pinata.cloud/pinning/pinFileToIPFS",

      fd,

      {

        maxBodyLength:
          Infinity,

        headers: {

          ...fd.getHeaders(),

          Authorization:
            `Bearer ${process.env.PINATA_JWT}`

        }

      }

    );


  return `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`;

}


/* ======================================================
   ADMIN UPLOAD REPORT
   SUPPORTS:

   1. NORMAL WEBSITE ORDER
      → Order

   2. API ORDER
      → ApiOrder

   EXISTING WEBSITE FLOW REMAINS
   UNCHANGED.
====================================================== */

router.post(

  "/upload-report",

  adminAuth,

  upload.fields([
    {
      name:
        "aiReport",

      maxCount:
        1
    },

    {
      name:
        "plagReport",

      maxCount:
        1
    }
  ]),

  async (req, res) => {

    try {

      const adminName =
        req.admin.username;

      const {
        orderId
      } =
        req.body;


      if (!orderId) {

        return res.status(400).json({

          success:
            false,

          error:
            "orderId required"

        });

      }


      /* ==================================================
         FIRST:
         TRY NORMAL WEBSITE ORDER
      ================================================== */

      let order =
        await Order.findById(
          orderId
        );


      let isApiOrder =
        false;


      /* ==================================================
         IF NORMAL ORDER DOES NOT EXIST,
         TRY API ORDER
      ================================================== */

      if (!order) {

        order =
          await ApiOrder.findById(
            orderId
          );

        isApiOrder =
          !!order;

      }


      /* ==================================================
         ORDER NOT FOUND
      ================================================== */

      if (!order) {

        return res.status(404).json({

          success:
            false,

          error:
            "Order not found"

        });

      }


      console.log(
        isApiOrder
          ? "🔵 API ORDER REPORT UPLOAD:"
          : "🟢 WEBSITE ORDER REPORT UPLOAD:",
        orderId
      );


      /* ==================================================
         AI REPORT
      ================================================== */

      if (
        req.files?.aiReport?.[0]
      ) {

        const aiFile =
          req.files.aiReport[0];


        const aiURL =
          await uploadToPinata(
            aiFile
          );


        order.aiReport = {

          filename:
            aiFile.originalname,

          storedName:
            aiURL

        };


        /* ================================================
           ADMIN ACTIVITY

           Keep existing activity for website orders.
           API orders don't use AdminActivity because
           its orderId may be designed for Order.
        ================================================ */

        if (!isApiOrder) {

          await AdminActivity.create({

            adminId:
              req.admin.id,

            orderId,

            type:
              "ai"

          });

        }

      }


      /* ==================================================
         PLAGIARISM REPORT
      ================================================== */

      if (
        req.files?.plagReport?.[0]
      ) {

        const plagFile =
          req.files.plagReport[0];


        const plagURL =
          await uploadToPinata(
            plagFile
          );


        order.plagReport = {

          filename:
            plagFile.originalname,

          storedName:
            plagURL

        };


        /* ================================================
           ADMIN ACTIVITY
        ================================================ */

        if (!isApiOrder) {

          await AdminActivity.create({

            adminId:
              req.admin.id,

            orderId,

            type:
              "plag"

          });

        }

      }


      /* ==================================================
         STATUS
      ================================================== */

      if (
        order.aiReport?.storedName &&
        order.plagReport?.storedName
      ) {

        order.status =
          "completed";

        order.processing =
          false;

        order.completedAt =
          new Date();

        /* ================================================
           NORMAL WEBSITE ORDER
           Keep existing completedBy
        ================================================ */

        if (!isApiOrder) {

          order.completedBy =
            adminName;

        }

      } else {

        order.status =
          "pending";

      }


      await order.save();


      /* ==================================================
         CREDIT

         API credit was already deducted when API
         submission was accepted.

         Website credit was already deducted at upload.

         THEREFORE:
         NO CREDIT DEDUCTION HERE.
      ================================================== */

      console.log(
        "💳 Credit already deducted:",
        order.creditDeducted
      );


      /* ==================================================
         DISCORD

         Only normal website orders use Discord.
      ================================================== */

      if (!isApiOrder) {

        try {

          if (
            order.discord_messages?.length >
            0
          ) {

            await updateDiscordOrder(
              order,
              order.discord_messages
            );


            console.log(
              "🔄 Discord updated for:",
              orderId
            );

          }

        } catch (err) {

          console.error(
            "❌ Discord update error:",
            err
          );

        }

      }


      /* ==================================================
         RESPONSE
      ================================================== */

      return res.json({

        success:
          true,

        order_id:
          order._id,

        order_type:
          isApiOrder
            ? "api"
            : "website",

        status:
          order.status

      });

    } catch (err) {

      console.error(
        "ADMIN UPLOAD ERROR:",
        err
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Failed to upload reports"

      });

    }

  }

);


export default router;
