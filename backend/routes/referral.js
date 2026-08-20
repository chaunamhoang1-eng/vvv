import express from "express";
import crypto from "crypto";

import User from "../models/user.js";

const router = express.Router();


/* ======================================================
   GET MY REFERRAL
   GET /api/referral/my-referral

   Firebase authentication is ALREADY done by:

   app.use("/api", firebaseAuth)

   Therefore use req.firebaseUser
   and DO NOT verify the token again.
====================================================== */

router.get(
  "/my-referral",

  async (req, res) => {

    try {

      const firebaseUser =
        req.firebaseUser;


      if (!firebaseUser) {

        return res.status(401).json({
          message:
            "Unauthorized"
        });

      }


      const uid =
        firebaseUser.uid;


      const email =
        firebaseUser.email;


      console.log(
        "Referral request from:",
        email,
        "| UID:",
        uid
      );


      /* ==================================================
         FIND USER
      ================================================== */

      let user =
        await User.findOne({
          firebaseUid: uid
        });


      /*
        Fallback for old users who may not
        have firebaseUid stored.
      */

      if (!user && email) {

        user =
          await User.findOne({
            email:
              email.toLowerCase()
          });


        /*
          Connect old user to Firebase UID
        */

        if (user) {

          user.firebaseUid =
            uid;

          await user.save();

        }

      }


      if (!user) {

        return res.status(404).json({
          message:
            "User not found"
        });

      }


      /* ==================================================
         CREATE REFERRAL CODE IF MISSING
      ================================================== */

      if (!user.referralCode) {

        let referralCode;

        let codeExists = true;


        while (codeExists) {

          referralCode =
            crypto
              .randomBytes(4)
              .toString("hex")
              .toUpperCase();


          const existingCode =
            await User.findOne({
              referralCode
            });


          if (!existingCode) {

            codeExists = false;

          }

        }


        user.referralCode =
          referralCode;


        await user.save();

      }


      /* ==================================================
         COUNT REFERRALS
      ================================================== */

      const referralCount =
        await User.countDocuments({
          referredBy:
            user._id
        });


      /* ==================================================
         RESPONSE
      ================================================== */

      const referralLink =
        `${req.protocol}://${req.get("host")}/register.html?ref=${user.referralCode}`;


      return res.json({

        success:
          true,

        referralCode:
          user.referralCode,

        referralLink,

        referralCount,

        referralRewards:
          user.referralRewards || 0

      });


    } catch (error) {

      console.error(
        "❌ Referral route error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        message:
          "Unable to load referral information"

      });

    }

  }
);


export default router;
