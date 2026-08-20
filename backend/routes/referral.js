import express from "express";
import User from "../models/user.js";

const router = express.Router();


/* =====================================================
   AUTH MIDDLEWARE
===================================================== */

function requireAuth(req, res, next) {
  try {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization required"
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization token"
      });
    }


    /*
      IMPORTANT:

      This expects your existing authentication middleware
      to attach the user ID to the request.

      If you already have an auth middleware, replace this
      middleware with your existing one.
    */

    req.userId = token;

    next();

  } catch (error) {

    console.error("Auth middleware error:", error);

    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });

  }
}


/* =====================================================
   GENERATE UNIQUE REFERRAL CODE
===================================================== */

async function generateReferralCode(user) {

  const name =
    user.email
      .split("@")[0]
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 8)
      .toUpperCase();


  let referralCode;
  let exists = true;


  while (exists) {

    const randomNumber =
      Math.floor(
        1000 + Math.random() * 9000
      );


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
===================================================== */

router.get(
  "/my-referral",
  requireAuth,
  async (req, res) => {

    try {


      const user =
        await User.findById(
          req.userId
        );


      if (!user) {

        return res.status(404).json({
          success: false,
          message: "User not found"
        });

      }


      /*
        Create referral code if user
        does not already have one
      */

      if (!user.referralCode) {

        user.referralCode =
          await generateReferralCode(user);


        await user.save();

      }


      /*
        Count users referred by this user
      */

      const referralCount =
        await User.countDocuments({
          referredBy: user._id
        });


      /*
        Build referral link
      */

      const referralLink =
        `https://plagxdetector.com/register.html?ref=${user.referralCode}`;


      /*
        Return referral information
      */

      return res.json({

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
        "Get referral error:",
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
