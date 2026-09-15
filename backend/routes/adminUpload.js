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


/* ======================================================
   MULTER MEMORY
====================================================== */

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


      /* ==================================================
         REMOVE TOP-RIGHT SUBMISSION ID
      ================================================== */

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


      /* ==================================================
         REMOVE BOTTOM-RIGHT SUBMISSION ID
      ================================================== */

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


      /* ==================================================
         PAGE 1 CLEANING
      ================================================== */

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


  /* ==================================================
     CLEAN PDF
  ================================================== */

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
   API CALLBACK
======================================================

   IMPORTANT:

   This function is ONLY called for ApiOrder.

   Normal website Order objects NEVER call this.

====================================================== */

async function sendApiCallback(order) {

  if (!order.callbackURL) {

    console.log(
      "ℹ️ API order has no callback URL:",
      order._id.toString()
    );

    return;

  }


  /* ==================================================
     CALLBACK PAYLOAD
  ================================================== */

  const payload = {

    success:
      true,

    order_id:
      order._id,

    status:
      order.status,

    file_url:
      order.fileURL,

    filename:
      order.filename || null,

    ai_report:
      order.aiReport || null,

    similarity_report:
      order.plagReport || null,

    created_at:
      order.createdAt,

    completed_at:
      order.completedAt || null

  };


  console.log(
    "\n📡 API CALLBACK STARTING"
  );

  console.log(
    "🆔 Order:",
    order._id.toString()
  );

  console.log(
    "🔗 Callback URL:",
    order.callbackURL
  );


  try {

    const response =
      await axios.post(

        order.callbackURL,

        payload,

        {

          headers: {

            "Content-Type":
              "application/json"

          },

          timeout:
            30000,

          validateStatus:
            () => true

        }

      );


    console.log(
      "📥 API CALLBACK RESPONSE:",
      response.status
    );


    if (
      response.status < 200 ||
      response.status >= 300
    ) {

      console.error(
        "❌ API CALLBACK FAILED:",
        response.status,
        response.data
      );

      return;

    }


    console.log(
      "✅ API CALLBACK SENT SUCCESSFULLY:",
      order._id.toString()
    );

  } catch (err) {

    /*
       IMPORTANT:

       Callback failure must NOT make the
       completed API order fail.

       The reports are already saved.
    */

    console.error(
      "❌ API CALLBACK ERROR:",
      err.message
    );

  }

}


/* ======================================================
   ADMIN UPLOAD REPORT

   SUPPORTS:

   1. NORMAL WEBSITE ORDER
      → Order

   2. API ORDER
      → ApiOrder

   EXISTING WEBSITE FLOW IS PRESERVED.
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


      /* ==================================================
         VALIDATE ORDER ID
      ================================================== */

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
         REMEMBER PREVIOUS STATUS
         
         Used only for API callback.

         This prevents sending callback again
         when an already completed API order
         is edited later.
      ================================================== */

      const previousStatus =
        order.status;


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

           ONLY WEBSITE ORDERS
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

           ONLY WEBSITE ORDERS
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

           Existing behavior preserved.
        ================================================ */

        if (!isApiOrder) {

          order.completedBy =
            adminName;

        }

      } else {

        order.status =
          "pending";

      }


      /* ==================================================
         SAVE ORDER
      ================================================== */

      await order.save();


      /* ==================================================
         CREDIT

         NO CREDIT DEDUCTION HERE.

         Website:
         credit was already deducted at upload.

         API:
         credit was already deducted at /check.
      ================================================== */

      console.log(
        "💳 Credit already deducted:",
        order.creditDeducted
      );


      /* ==================================================
         DISCORD

         ONLY NORMAL WEBSITE ORDERS
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
         API CALLBACK

         ONLY API ORDERS

         Callback is sent only when the order
         changes from something else → completed.

         Therefore:

         pending → completed = callback

         completed → completed = NO callback

         Website orders = NO callback
      ================================================== */

      if (
        isApiOrder &&
        previousStatus !== "completed" &&
        order.status === "completed"
      ) {

        /*
           Do not await this.

           The admin should immediately receive
           a successful response even if the
           customer's callback server is slow.
        */

        sendApiCallback(
          order
        ).catch(err => {

          console.error(
            "❌ Unexpected callback error:",
            err.message
          );

        });

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
