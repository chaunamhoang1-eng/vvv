import express from "express";
import crypto from "crypto";

import User from "../models/user.js";

const router = express.Router();


/* ======================================================
   GET MY REFERRAL
   GET /api/referral/my-referral
====================================================== */

router.get(
  "/my-referral",

  async (req, res) => {

    try {

      const firebaseUser = req.firebaseUser;


      /* ==================================================
         AUTH CHECK
      ================================================== */

      if (!firebaseUser) {

        return res.status(401).json({
          success: false,
          message: "Unauthorized"
        });

      }


      const uid = firebaseUser.uid;
      const email = firebaseUser.email;


      console.log(
        "Referral request:",
        email,
        "| UID:",
        uid
      );


      /* ==================================================
         FIND CURRENT USER
      ================================================== */

      let user = await User.findOne({
        firebaseUid: uid
      });


      /*
        Fallback for existing users
      */

      if (!user && email) {

        user = await User.findOne({
          email: email.toLowerCase()
        });


        if (user) {

          user.firebaseUid = uid;

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
         CREATE REFERRAL CODE ONLY IF MISSING
      ================================================== */

      if (!user.referralCode) {

        let referralCode;
        let codeExists = true;


        while (codeExists) {

          referralCode = crypto
            .randomBytes(4)
            .toString("hex")
            .toUpperCase();


          const existingCode = await User.findOne({
            referralCode
          });


          if (!existingCode) {

            codeExists = false;

          }

        }


        user.referralCode = referralCode;

        await user.save();


        console.log(
          "New referral code created:",
          referralCode
        );

      }


      /* ==================================================
         GET ALL REFERRED USERS
      ================================================== */

      const referrals = await User.find({

        referredBy: user._id

      })
        .select(
          "email hasPurchased createdAt credits"
        )
        .sort({
          createdAt: -1
        });


      /* ==================================================
         TOTAL REFERRALS
      ================================================== */

      const referralCount =
        referrals.length;


      /* ==================================================
         SUCCESSFUL REFERRALS

         Currently:
         successful = user has purchased

         Change this logic later if needed.
      ================================================== */

      const successfulReferrals =
        referrals.filter(
          referral =>
            referral.hasPurchased === true
        );


      const successfulCount =
        successfulReferrals.length;


      /* ==================================================
         REFERRAL ACTIVITY
      ================================================== */

      const referralActivity =
        referrals.map(
          referral => ({

            id:
              referral._id,

            /*
              Hide part of email for privacy
            */

            email:
              maskEmail(
                referral.email
              ),

            createdAt:
              referral.createdAt,

            hasPurchased:
              referral.hasPurchased === true,

            status:
              referral.hasPurchased
                ? "Successful"
                : "Registered"

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

        totalReferrals:
          referralCount,

        referralCount:
          referralCount,

        successfulReferrals:
          successfulCount,

        successfulCount:
          successfulCount,

        rewardsEarned:
          user.referralRewards || 0,

        referralRewards:
          user.referralRewards || 0,

        referrals:
          referralActivity

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


/* ======================================================
   MASK EMAIL
====================================================== */

function maskEmail(email) {

  if (!email) {
    return "Unknown user";
  }


  const parts =
    email.split("@");


  const username =
    parts[0];


  const domain =
    parts[1];


  if (username.length <= 2) {

    return (
      username.charAt(0) +
      "*" +
      "@" +
      domain
    );

  }


  return (

    username.substring(0, 2) +

    "***@" +

    domain

  );

}


export default router;
