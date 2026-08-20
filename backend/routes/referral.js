import express from "express";
import crypto from "crypto";

import User from "../models/user.js";

const router = express.Router();


/* ======================================================
   GET MY REFERRAL
   GET /api/referral/my-referral

   Firebase authentication is already handled by:

   app.use("/api", firebaseAuth)

   Therefore use req.firebaseUser
====================================================== */

router.get(
  "/my-referral",

  async (req, res) => {

    try {

      const firebaseUser =
        req.firebaseUser;


      if (!firebaseUser) {

        return res.status(401).json({
          success: false,
          message: "Unauthorized"
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
         FIND CURRENT USER
      ================================================== */

      let user =
        await User.findOne({
          firebaseUid: uid
        });


      /*
         FALLBACK FOR OLD USERS
      */

      if (!user && email) {

        user =
          await User.findOne({
            email:
              email.toLowerCase()
          });


        if (user) {

          user.firebaseUid =
            uid;

          await user.save();

        }

      }


      if (!user) {

        return res.status(404).json({
          success: false,
          message: "User not found"
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


          const existingUser =
            await User.findOne({
              referralCode
            });


          if (!existingUser) {

            codeExists = false;

          }

        }


        user.referralCode =
          referralCode;

        await user.save();

      }


      /* ==================================================
         GET ALL REFERRED USERS
      ================================================== */

      const referredUsers =
        await User.find({
          referredBy:
            user._id
        })
        .select(
          "email createdAt hasPurchased credits referralRewarded"
        )
        .sort({
          createdAt: -1
        });


      /* ==================================================
         TOTAL REFERRALS
      ================================================== */

      const totalReferrals =
        referredUsers.length;


      /* ==================================================
         SUCCESSFUL REFERRALS

         Here successful = person has purchased
      ================================================== */

      const successfulReferrals =
        referredUsers.filter(
          (referredUser) =>
            referredUser.hasPurchased === true
        ).length;


      /* ==================================================
         REFERRAL ACTIVITY
      ================================================== */

      const referrals =
        referredUsers.map(
          (referredUser) => ({

            email:
              referredUser.email,

            registeredAt:
              referredUser.createdAt,

            hasPurchased:
              referredUser.hasPurchased,

            successful:
              referredUser.hasPurchased === true

          })
        );


      /* ==================================================
         REFERRAL LINK
      ================================================== */

      const referralLink =
        `${req.protocol}://${req.get("host")}/register.html?ref=${user.referralCode}`;


      /* ==================================================
         RESPONSE
      ================================================== */

      return res.json({

        success: true,

        referralCode:
          user.referralCode,

        referralLink,

        // Main stats
        totalReferrals,
        successfulReferrals,

        // Keep old name too for compatibility
        referralCount:
          totalReferrals,

        referralRewards:
          user.referralRewards || 0,

        // Referral activity
        referrals

      });


    } catch (error) {

      console.error(
        "❌ Referral route error:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "Unable to load referral information"

      });

    }

  }
);


export default router;
