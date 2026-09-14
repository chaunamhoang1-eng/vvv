// backend/routes/plagCheck.js

import express from "express";
import { requireApiKey } from "../middleware/requireApiKey.js";
import ApiOrder from "../models/ApiOrder.js";
import ApiUser from "../models/ApiUser.js";
import { processApiDocument } from "../services/apiProcessor.js";

const router = express.Router();


/* ======================================================
   POST /api/v1/plag/check

   Customer submits a document URL.

   Authentication:
   X-API-Key: px_live_xxxxxxxxx
====================================================== */

router.post(
  "/check",
  requireApiKey,
  async (req, res) => {

    const user = req.apiUser;

    const {
      file_url,
      student_name,
      reference
    } = req.body;


    /* ==================================================
       FILE URL REQUIRED
    ================================================== */

    if (!file_url) {

      return res.status(400).json({
        success: false,
        error: "file_url required"
      });

    }


    /* ==================================================
       ATOMIC CREDIT DEDUCTION
       
       We deduct exactly ONE credit when the
       API submission is accepted.
    ================================================== */

    let updatedUser;

    try {

      updatedUser =
        await ApiUser.findOneAndUpdate(

          {
            _id: user._id,
            status: "active",
            credits: {
              $gt: 0
            }
          },

          {
            $inc: {
              credits: -1,
              totalUsed: 1
            },

            $set: {
              lastUsedAt: new Date()
            }
          },

          {
            new: true
          }

        );


    } catch (err) {

      console.error(
        "❌ API CREDIT UPDATE ERROR:",
        err
      );

      return res.status(500).json({
        success: false,
        message: "Unable to process credits"
      });

    }


    /* ==================================================
       CREDIT CHECK
    ================================================== */

    if (!updatedUser) {

      return res.status(402).json({
        success: false,
        message: "Insufficient credits"
      });

    }


    try {

      /* ==================================================
         CREATE API ORDER
      ================================================== */

      const order =
        await ApiOrder.create({

          apiKey:
            user.apiKey,

          callbackURL:
            user.callbackURL || null,

          fileURL:
            file_url,

          /*
            The API currently receives a URL.
            The API processor will obtain the
            filename from the downloaded file / URL.
          */

          filename:
            null,

          storedName:
            null,

          historyId:
            null,

          status:
            "pending",

          processing:
            false,

          creditDeducted:
            true

        });


      console.log(
        "\n========================================"
      );

      console.log(
        "📡 [PUBLIC API] NEW SUBMISSION"
      );

      console.log(
        "🆔 API Order:",
        order._id.toString()
      );

      console.log(
        "🔑 API User:",
        user.apiKey
      );

      console.log(
        "🔗 File URL:",
        file_url
      );

      console.log(
        "👤 Student:",
        student_name || null
      );

      console.log(
        "🔖 Reference:",
        reference || null
      );

      console.log(
        "💳 Credits remaining:",
        updatedUser.credits
      );

      console.log(
        "========================================"
      );


      /* ==================================================
         START ASYNC FACULTY CHECKER PROCESSING

         IMPORTANT:
         Do NOT await this.

         API responds immediately while
         Faculty Checker processes the document.
      ================================================== */

      processApiDocument(
        order._id,
        file_url,
        {
          studentName:
            student_name || order._id.toString(),

          reference:
            reference || order._id.toString()
        }
      ).catch(
        (err) => {

          console.error(
            "❌ [PUBLIC API] ASYNC PROCESS ERROR:",
            err
          );

        }
      );


      /* ==================================================
         RESPONSE
      ================================================== */

      return res.status(202).json({

        success:
          true,

        message:
          "File submitted successfully",

        order_id:
          order._id,

        status:
          "processing",

        credits_left:
          updatedUser.credits

      });


    } catch (err) {

      console.error(
        "❌ [PUBLIC API] SUBMISSION ERROR:",
        err
      );


      /* ==================================================
         REFUND CREDIT

         Credit was deducted, but API order creation
         failed. Return the credit.
      ================================================== */

      try {

        await ApiUser.findByIdAndUpdate(

          user._id,

          {
            $inc: {
              credits: 1,
              totalUsed: -1
            }
          }

        );

        console.log(
          "↩️ [PUBLIC API] CREDIT REFUNDED"
        );

      } catch (refundError) {

        console.error(
          "❌ [PUBLIC API] CREDIT REFUND FAILED:",
          refundError
        );

      }


      return res.status(500).json({

        success:
          false,

        message:
          "Failed to submit file"

      });

    }

  }
);


export default router;
