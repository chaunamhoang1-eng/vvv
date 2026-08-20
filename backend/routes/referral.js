import express from "express";
import User from "../models/user.js";

const router = express.Router();


/* =====================================================
   GENERATE UNIQUE REFERRAL CODE
===================================================== */

async function generateReferralCode(user) {

  const name = user.email
    ? user.email
        .split("@")[0]
        .replace(/[^a-zA-Z0-9]/g, "")
        .substring(0, 8)
        .toUpperCase()
    : "PLAGX";

  let referralCode;
  let exists = true;

  while (exists) {

    const randomNumber =
      Math.floor(1000 + Math.random() * 9000);

    referralCode =
      `${name}${randomNumber}`;

    const existingUser =
      await User.findOne({
        referralCode
      });

    exists = !!existingUser;
  }

  return referralCode;
}


/* =====================================================
   GET MY REFERRAL INFORMATION
   firebaseAuth middleware already runs before this route
===================================================== */

router.get(
  "/my-referral",

  async (req, res) => {

    try {

      if (!req.firebaseUser) {

        return res.status(401).json({
          success: false,
          message: "Unauthorized"
        });

      }


      const {
        uid,
        email
      } = req.firebaseUser;


      /* ================================================
         FIND USER BY FIREBASE UID
      ================================================= */

      let user =
        await User.findOne({
          firebaseUid: uid
        });


      /* ================================================
         FALLBACK FOR EXISTING USERS
      ================================================= */

      if (!user && email) {

        user =
          await User.findOne({
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


      /* ================================================
         CREATE REFERRAL CODE IF MISSING
      ================================================= */

      if (!user.referralCode) {

        user.referralCode =
          await generateReferralCode(user);

        await user.save();

      }


      /* ================================================
         COUNT REFERRED USERS
      ================================================= */

      const referralCount =
        await User.countDocuments({
          referredBy: user._id
        });


      /* ================================================
         BUILD REFERRAL LINK
      ================================================= */

      const referralLink =
        `${req.protocol}://${req.get("host")}/register.html?ref=${user.referralCode}`;


      /* ================================================
         RETURN DATA
      ================================================= */

      return res.status(200).json({

        success: true,

        referralCode:
          user.referralCode,

        referralLink,

        referralCount,

        referralRewards:
          user.referralRewards || 0

      });

    } catch (error) {

      console.error(
        "❌ Referral error:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Failed to load referral information"

      });

    }

  }
);


export default router;
