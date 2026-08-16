import express from "express";
import axios from "axios";
import FormData from "form-data";
import multer from "multer";
import { sendOrderToDiscord } from "../utils/discordWebhook.js";

import Order from "../models/Order.js";
import User from "../models/user.js";

console.log("✅ upload.js loaded");

const router = express.Router();

/* ================= MULTER (MEMORY STORAGE) ================= */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});


/* ================= TEST ROUTE ================= */

router.get(
  "/upload-test",
  (_, res) => {
    res.json({
      ok: true
    });
  }
);


/* ======================================================
   POST /api/upload — USER UPLOAD

   IMPORTANT:
   1 successful upload = 1 credit immediately

   Atomic credit deduction prevents:
   3 credits + 5 simultaneous uploads
   from accepting all 5.
====================================================== */

router.post(
  "/upload",
  upload.single("file"),

  async (req, res) => {

    let creditReserved = false;
    let reservedUser = null;

    try {

      /* ==================================================
         FIREBASE AUTH
      ================================================== */

      if (!req.firebaseUser) {

        return res.status(401).json({
          message: "Unauthorized"
        });

      }


      const file =
        req.file;

      const {
        uid,
        email
      } = req.firebaseUser;


      /* ==================================================
         FILE CHECK
      ================================================== */

      if (!file) {

        return res.status(400).json({
          error: "File missing",
          hint: "Check input name='file'"
        });

      }


      /* ==================================================
         FIND + ATOMICALLY RESERVE 1 CREDIT
         
         IMPORTANT:
         credits must be > 0.

         MongoDB performs this atomically.
      ================================================== */

      reservedUser =
        await User.findOneAndUpdate(

          {
            $or: [
              {
                firebaseUid: uid
              },
              {
                email: email
              }
            ],

            hasPurchased: true,

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
              firebaseUid: uid,
              lastUsedAt: new Date()
            }
          },

          {
            new: true
          }

        );


      /* ==================================================
         NO CREDIT
      ================================================== */

      if (!reservedUser) {

        return res.status(403).json({
          error: "No credits available"
        });

      }


      /* ==================================================
         CREDIT SUCCESSFULLY RESERVED
      ================================================== */

      creditReserved = true;

      console.log(
        "💳 CREDIT DEDUCTED:",
        {
          email,
          remainingCredits:
            reservedUser.credits,
          file:
            file.originalname
        }
      );


      /* ==================================================
         UPLOAD TO PINATA
      ================================================== */

      const form =
        new FormData();


      form.append(
        "file",
        file.buffer,
        {
          filename:
            file.originalname,

          contentType:
            file.mimetype
        }
      );


      form.append(
        "pinataMetadata",
        JSON.stringify({
          name:
            file.originalname
        })
      );


      const pinataRes =
        await axios.post(

          "https://api.pinata.cloud/pinning/pinFileToIPFS",

          form,

          {
            maxBodyLength:
              Infinity,

            headers: {
              ...form.getHeaders(),

              Authorization:
                `Bearer ${process.env.PINATA_JWT}`
            }
          }

        );


      const ipfs =
        pinataRes.data.IpfsHash;


      const fileURL =
        `https://gateway.pinata.cloud/ipfs/${ipfs}`;


      /* ==================================================
         SAVE ORDER
         
         creditDeducted = true
         because credit was already deducted above.
      ================================================== */

      const order =
        await Order.create({

          firebaseUid:
            uid,

          email,

          filename:
            file.originalname,

          storedName:
            ipfs,

          fileURL,

          status:
            "pending",

          processing:
            false,

          creditDeducted:
            true

        });


      /* ==================================================
         DISCORD EMBED
      ================================================== */

      try {

        const discordMsg =
          await sendOrderToDiscord(
            order
          );


        if (discordMsg) {

          order.discord_messages =
            discordMsg;

          await order.save();

        }


        console.log(
          "📨 Webhook sent & stored."
        );

      } catch (err) {

        console.error(
          "❌ Discord send failed:",
          err
        );

        /*
          Discord failure does NOT
          cancel the upload.

          The order is already valid.
        */

      }


      /* ==================================================
         SUCCESS
      ================================================== */

      return res.json({

        success:
          true,

        orderId:
          order._id,

        fileURL,

        creditsRemaining:
          reservedUser.credits,

        message:
          "File uploaded successfully."

      });


    } catch (err) {

      console.error(
        "UPLOAD ERROR:",
        err
      );


      /* ==================================================
         REFUND CREDIT IF IT WAS DEDUCTED BUT UPLOAD FAILED
         
         Example:
         Credit deducted → Pinata failed

         We return the credit.
      ================================================== */

      if (
        creditReserved &&
        reservedUser
      ) {

        try {

          await User.updateOne(

            {
              _id:
                reservedUser._id
            },

            {
              $inc: {
                credits: 1,
                totalUsed: -1
              }
            }

          );


          console.log(
            "↩️ CREDIT REFUNDED AFTER UPLOAD FAILURE:",
            email
          );

        } catch (refundError) {

          console.error(
            "❌ CREDIT REFUND FAILED:",
            refundError
          );

        }

      }


      return res.status(500).json({

        error:
          "Server error",

        details:
          err.message

      });

    }

  }

);


/* ======================================================
   DELETE /api/delete/:id — USER DELETE ORDER
====================================================== */

router.delete(
  "/delete/:id",

  async (req, res) => {

    try {

      if (!req.firebaseUser) {

        return res.status(401).json({
          message:
            "Unauthorized"
        });

      }


      const {
        uid,
        email
      } =
        req.firebaseUser;


      console.log(
        "🔥 DELETE DEBUG:"
      );

      console.log(
        "User UID:",
        uid
      );

      console.log(
        "User EMAIL:",
        email
      );


      const test =
        await Order.findById(
          req.params.id
        );


      console.log(
        "Order found in DB:",
        test
      );


      /* ==================================================
         FIND USER'S ORDER
      ================================================== */

      const order =
        await Order.findOne({

          _id:
            req.params.id,

          $or: [
            {
              firebaseUid:
                uid
            },
            {
              email
            }
          ]

        });


      console.log(
        "Matched Order for deletion:",
        order
      );


      if (!order) {

        return res.status(404).json({
          error:
            "Order not found"
        });

      }


      /* ==================================================
         MIGRATE OLD ORDER
      ================================================== */

      if (!order.firebaseUid) {

        order.firebaseUid =
          uid;

        await order.save();

        console.log(
          "Auto-linked order:",
          order._id
        );

      }


      /* ==================================================
         DELETE ORDER
      ================================================== */

      await order.deleteOne();


      console.log(
        "🗑 Order deleted:",
        req.params.id
      );


      return res.json({

        success:
          true,

        message:
          "Order deleted successfully"

      });


    } catch (err) {

      console.error(
        "❌ DELETE ERROR:",
        err
      );


      return res.status(500).json({

        error:
          "Failed to delete order"

      });

    }

  }

);


export default router;
