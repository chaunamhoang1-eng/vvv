import express from "express";
import crypto from "crypto";
import admin from "../utils/firebaseAdmin.js";
import User from "../models/user.js";

const router = express.Router();

/* ======================================================
   HELPERS
====================================================== */

// Generate secure 6-digit OTP
function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

// Hash OTP before storing it in MongoDB
function hashOTP(otp) {
  return crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");
}


/* ======================================================
   BREVO EMAIL
====================================================== */

async function sendBrevoOTP(email, otp) {
  const response = await fetch(
    "https://api.brevo.com/v3/smtp/email",
    {
      method: "POST",

      headers: {
        accept: "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json"
      },

      body: JSON.stringify({
        sender: {
          name: process.env.BREVO_SENDER_NAME || "PlagX",
          email:
            process.env.BREVO_SENDER_EMAIL ||
            "noreply@plagxdetector.com"
        },

        to: [
          {
            email
          }
        ],

        subject: "Your PlagX Verification Code",

        htmlContent: `
          <!DOCTYPE html>
          <html>
          <body style="
            margin:0;
            padding:0;
            background:#f5f5f5;
            font-family:Arial,sans-serif;
          ">

            <div style="
              max-width:600px;
              margin:40px auto;
              background:#ffffff;
              padding:30px;
              border-radius:12px;
            ">

              <h2 style="margin-top:0;">
                Verify your PlagX account
              </h2>

              <p>
                Your PlagX verification code is:
              </p>

              <div style="
                font-size:32px;
                font-weight:bold;
                letter-spacing:8px;
                margin:25px 0;
              ">
                ${otp}
              </div>

              <p>
                This code will expire in
                <strong>10 minutes</strong>.
              </p>

              <p>
                If you did not create a PlagX account,
                you can safely ignore this email.
              </p>

              <hr style="
                border:none;
                border-top:1px solid #eee;
                margin:25px 0;
              ">

              <p style="
                color:#777;
                font-size:13px;
              ">
                PlagX<br>
                plagxdetector.com
              </p>

            </div>

          </body>
          </html>
        `
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      "❌ Brevo API Error:",
      errorText
    );

    throw new Error("Brevo email failed");
  }

  return response.json();
}


/* ======================================================
   AUTHENTICATE FIREBASE USER
====================================================== */

async function getFirebaseUser(req) {
  const authHeader = req.headers.authorization;

  if (
    !authHeader ||
    !authHeader.startsWith("Bearer ")
  ) {
    throw new Error("Missing Firebase token");
  }

  const token = authHeader.split(" ")[1];

  return await admin.auth().verifyIdToken(token);
}


/* ======================================================
   SEND OTP
   POST /auth/send-otp
====================================================== */

router.post("/send-otp", async (req, res) => {
  try {
    const decodedToken =
      await getFirebaseUser(req);

    const uid = decodedToken.uid;
    const email = decodedToken.email;

    if (!email) {
      return res.status(400).json({
        error: "Firebase account has no email"
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    /* ----------------------------------------------
       FIND OR CREATE MONGODB USER
    ---------------------------------------------- */

    let user = await User.findOne({
      $or: [
        { firebaseUid: uid },
        { email: normalizedEmail }
      ]
    });

    if (!user) {
      user = new User({
        email: normalizedEmail,
        firebaseUid: uid,
        isVerified: false,
        credits: 0,
        hasPurchased: false
      });
    } else {

      // Link Firebase UID if old account exists
      if (!user.firebaseUid) {
        user.firebaseUid = uid;
      }

      // Don't send OTP to already verified users
      if (user.isVerified) {
        return res.status(400).json({
          error: "Email is already verified"
        });
      }
    }

    /* ----------------------------------------------
       60 SECOND RESEND PROTECTION
    ---------------------------------------------- */

    if (
      user.otpLastSent &&
      Date.now() -
        user.otpLastSent.getTime() <
        60000
    ) {
      const remaining = Math.ceil(
        (
          60000 -
          (
            Date.now() -
            user.otpLastSent.getTime()
          )
        ) / 1000
      );

      return res.status(429).json({
        error: `Please wait ${remaining} seconds before requesting another OTP.`,
        remaining
      });
    }

    /* ----------------------------------------------
       GENERATE OTP
    ---------------------------------------------- */

    const otp = generateOTP();

    user.otpHash = hashOTP(otp);

    user.otpExpires = new Date(
      Date.now() + 10 * 60 * 1000
    );

    user.otpAttempts = 0;

    user.otpLastSent = new Date();

    await user.save();

    /* ----------------------------------------------
       SEND EMAIL THROUGH BREVO
    ---------------------------------------------- */

    try {
      await sendBrevoOTP(
        normalizedEmail,
        otp
      );
    } catch (emailError) {

      console.error(
        "❌ OTP email failed:",
        emailError
      );

      // Clear OTP if email wasn't sent
      user.otpHash = null;
      user.otpExpires = null;
      user.otpLastSent = null;

      await user.save();

      return res.status(500).json({
        error:
          "Unable to send verification email. Please try again."
      });
    }

    return res.json({
      success: true,
      message:
        "Verification code sent to your email.",
      expiresIn: 600
    });

  } catch (error) {

    console.error(
      "❌ Send OTP error:",
      error
    );

    return res.status(401).json({
      error:
        "Unable to authenticate your account."
    });
  }
});


/* ======================================================
   VERIFY OTP
   POST /auth/verify-otp
====================================================== */

router.post("/verify-otp", async (req, res) => {
  try {

    const decodedToken =
      await getFirebaseUser(req);

    const uid = decodedToken.uid;

    const user = await User.findOne({
      firebaseUid: uid
    });

    if (!user) {
      return res.status(404).json({
        error: "User account not found"
      });
    }

    /* ----------------------------------------------
       ALREADY VERIFIED
    ---------------------------------------------- */

    if (user.isVerified) {
      return res.json({
        success: true,
        message: "Email already verified"
      });
    }

    /* ----------------------------------------------
       CHECK OTP EXISTS
    ---------------------------------------------- */

    if (
      !user.otpHash ||
      !user.otpExpires
    ) {
      return res.status(400).json({
        error:
          "No active OTP. Please request a new code."
      });
    }

    /* ----------------------------------------------
       CHECK EXPIRY
    ---------------------------------------------- */

    if (
      user.otpExpires.getTime() <
      Date.now()
    ) {

      user.otpHash = null;
      user.otpExpires = null;
      user.otpAttempts = 0;

      await user.save();

      return res.status(400).json({
        error:
          "OTP has expired. Please request a new code."
      });
    }

    /* ----------------------------------------------
       MAX 5 ATTEMPTS
    ---------------------------------------------- */

    if (user.otpAttempts >= 5) {
      return res.status(429).json({
        error:
          "Too many incorrect attempts. Please request a new OTP."
      });
    }

    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        error: "OTP is required"
      });
    }

    const submittedHash =
      hashOTP(
        otp.toString().trim()
      );

    /* ----------------------------------------------
       INVALID OTP
    ---------------------------------------------- */

    if (
      submittedHash !==
      user.otpHash
    ) {

      user.otpAttempts += 1;

      await user.save();

      return res.status(400).json({
        error: "Invalid OTP",
        attemptsRemaining:
          Math.max(
            0,
            5 - user.otpAttempts
          )
      });
    }

    /* ----------------------------------------------
       OTP CORRECT
    ---------------------------------------------- */

    user.isVerified = true;

    user.otpHash = null;
    user.otpExpires = null;
    user.otpAttempts = 0;
    user.otpLastSent = null;

    await user.save();

    /* ----------------------------------------------
       MARK FIREBASE EMAIL VERIFIED
    ---------------------------------------------- */

    await admin.auth().updateUser(
      uid,
      {
        emailVerified: true
      }
    );

    return res.json({
      success: true,
      message:
        "Email verified successfully!"
    });

  } catch (error) {

    console.error(
      "❌ Verify OTP error:",
      error
    );

    return res.status(500).json({
      error:
        "Server error during OTP verification"
    });
  }
});


/* ======================================================
   RESEND OTP
   POST /auth/resend-otp
====================================================== */

router.post("/resend-otp", async (req, res) => {
  try {

    const decodedToken =
      await getFirebaseUser(req);

    const uid = decodedToken.uid;

    const user = await User.findOne({
      firebaseUid: uid
    });

    if (!user) {
      return res.status(404).json({
        error: "User account not found"
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        error: "Email is already verified"
      });
    }

    /* ----------------------------------------------
       60 SECOND LIMIT
    ---------------------------------------------- */

    if (
      user.otpLastSent &&
      Date.now() -
        user.otpLastSent.getTime() <
        60000
    ) {

      const remaining =
        Math.ceil(
          (
            60000 -
            (
              Date.now() -
              user.otpLastSent.getTime()
            )
          ) / 1000
        );

      return res.status(429).json({
        error:
          `Please wait ${remaining} seconds before requesting another OTP.`,
        remaining
      });
    }

    /* ----------------------------------------------
       NEW OTP
    ---------------------------------------------- */

    const otp = generateOTP();

    user.otpHash = hashOTP(otp);

    user.otpExpires = new Date(
      Date.now() + 10 * 60 * 1000
    );

    user.otpAttempts = 0;

    user.otpLastSent = new Date();

    await user.save();

    await sendBrevoOTP(
      user.email,
      otp
    );

    return res.json({
      success: true,
      message:
        "New verification code sent.",
      expiresIn: 600
    });

  } catch (error) {

    console.error(
      "❌ Resend OTP error:",
      error
    );

    return res.status(500).json({
      error:
        "Unable to resend OTP"
    });
  }
});


export default router;
