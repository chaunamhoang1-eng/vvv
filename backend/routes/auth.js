```js
import express from "express";
import User from "../models/user.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import admin from "../utils/firebaseAdmin.js";

const router = express.Router();

/* ======================================================
   REFERRAL CODE GENERATOR
====================================================== */

async function generateReferralCode() {
  let referralCode;
  let exists = true;

  while (exists) {
    referralCode =
      "PLAGX" +
      crypto.randomBytes(4)
        .toString("hex")
        .toUpperCase();

    exists = await User.exists({
      referralCode
    });
  }

  return referralCode;
}

/* ======================================================
   BREVO OTP EMAIL
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
          name:
            process.env.BREVO_SENDER_NAME ||
            "PlagX",

          email:
            process.env.BREVO_SENDER_EMAIL ||
            "noreply@plagxdetector.com"
        },

        to: [
          {
            email
          }
        ],

        subject:
          "Your PlagX Verification Code",

        htmlContent: `
          <div style="
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: auto;
            padding: 30px;
            color: #222;
          ">

            <h2>
              Verify your PlagX account
            </h2>

            <p>
              Your PlagX verification code is:
            </p>

            <div style="
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
              margin: 25px 0;
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

            <hr>

            <p style="
              color: #777;
              font-size: 13px;
            ">
              PlagX<br>
              plagxdetector.com
            </p>

          </div>
        `
      })
    }
  );

  if (!response.ok) {

    const errorText =
      await response.text();

    console.error(
      "Brevo API error:",
      errorText
    );

    throw new Error(
      "Brevo email failed"
    );
  }

  return response.json();
}

/* ======================================================
   LEGACY REGISTER
   POST /auth/register
====================================================== */

router.post(
  "/register",
  async (req, res) => {

    const {
      email,
      password,
      referralCode: referralCodeInput
    } = req.body;

    try {

      if (!email || !password) {

        return res.status(400).json({
          error:
            "Email and password are required."
        });
      }

      const existingUser =
        await User.findOne({
          email:
            email.trim().toLowerCase()
        });

      if (existingUser) {

        return res.status(400).json({
          error:
            "Email already registered."
        });
      }

      const hashed =
        await bcrypt.hash(
          password,
          10
        );

      const referralCode =
        await generateReferralCode();

      let referredBy = null;

      if (referralCodeInput) {

        const referrer =
          await User.findOne({
            referralCode:
              referralCodeInput
                .trim()
                .toUpperCase()
          });

        if (referrer) {
          referredBy = referrer._id;
        }
      }

      await new User({

        email:
          email.trim().toLowerCase(),

        password:
          hashed,

        referralCode,

        referredBy

      }).save();

      return res.json({
        message:
          "User Registered Successfully"
      });

    } catch (error) {

      console.error(
        "Legacy registration error:",
        error
      );

      return res.status(500).json({
        error:
          "Server error during registration"
      });
    }
  }
);

/* ======================================================
   LEGACY LOGIN
   POST /auth/login
====================================================== */

router.post(
  "/login",
  async (req, res) => {

    const {
      email,
      password
    } = req.body;

    try {

      const user =
        await User.findOne({
          email:
            email.trim().toLowerCase()
        });

      if (!user) {

        return res.status(400).json({
          error:
            "User not found"
        });
      }

      if (!user.password) {

        return res.status(400).json({
          error:
            "Please login using Firebase authentication."
        });
      }

      const isMatch =
        await bcrypt.compare(
          password,
          user.password
        );

      if (!isMatch) {

        return res.status(400).json({
          error:
            "Invalid password"
        });
      }

      return res.json({
        message:
          "Login Success"
      });

    } catch (error) {

      console.error(
        "Legacy login error:",
        error
      );

      return res.status(500).json({
        error:
          "Server error during login"
      });
    }
  }
);

/* ======================================================
   FORGOT PASSWORD
   POST /auth/forgot
====================================================== */

router.post(
  "/forgot",
  async (req, res) => {

    const {
      email
    } = req.body;

    try {

      const user =
        await User.findOne({
          email:
            email.trim().toLowerCase()
        });

      if (!user) {

        return res.json({
          message:
            "If the email exists, a reset link was sent."
        });
      }

      const token =
        crypto.randomBytes(
          32
        ).toString("hex");

      user.resetToken =
        token;

      user.resetTokenExpire =
        Date.now() +
        3600000;

      await user.save();

      const resetLink =
        `http://localhost:5000/reset.html?token=${token}`;

      if (
        process.env.GMAIL_USER &&
        process.env.GMAIL_APP_PASSWORD
      ) {

        const nodemailer =
          await import(
            "nodemailer"
          );

        const transporter =
          nodemailer.default.createTransport({

            service:
              "gmail",

            auth: {

              user:
                process.env.GMAIL_USER,

              pass:
                process.env.GMAIL_APP_PASSWORD

            }

          });

        await transporter.sendMail({

          to: email,

          subject:
            "PlagX Password Reset",

          html: `

            <h3>
              Password Reset Request
            </h3>

            <p>
              Click the link below
              to reset your password:
            </p>

            <a href="${resetLink}">
              Reset Password
            </a>

            <p>
              This link is valid
              for 1 hour.
            </p>

          `
        });

      } else {

        console.warn(
          "Gmail credentials not configured. Password reset email was not sent."
        );

      }

      return res.json({
        message:
          "If the email exists, a reset link was sent."
      });

    } catch (error) {

      console.error(
        "Forgot password error:",
        error
      );

      return res.status(500).json({
        error:
          "Error sending reset link"
      });
    }
  }
);

/* ======================================================
   RESET PASSWORD
   POST /auth/reset
====================================================== */

router.post(
  "/reset",
  async (req, res) => {

    const {
      token,
      password
    } = req.body;

    try {

      const user =
        await User.findOne({

          resetToken:
            token,

          resetTokenExpire: {
            $gt:
              Date.now()
          }

        });

      if (!user) {

        return res.status(400).json({
          message:
            "Invalid or expired token"
        });
      }

      const hashed =
        await bcrypt.hash(
          password,
          10
        );

      user.password =
        hashed;

      user.resetToken =
        null;

      user.resetTokenExpire =
        null;

      await user.save();

      return res.json({
        message:
          "Password updated successfully!"
      });

    } catch (error) {

      console.error(
        "Reset password error:",
        error
      );

      return res.status(500).json({
        error:
          "Error resetting password"
      });
    }
  }
);

/* ======================================================
   SEND OTP
   POST /auth/send-otp

   Firebase user must already exist.
====================================================== */

router.post(
  "/send-otp",
  async (req, res) => {

    try {

      const {
        referralCode: referralCodeInput
      } = req.body;

      const authHeader =
        req.headers.authorization;

      if (
        !authHeader ||
        !authHeader.startsWith(
          "Bearer "
        )
      ) {

        return res.status(401).json({
          error:
            "Missing Firebase token"
        });
      }

      const token =
        authHeader.split(" ")[1];

      const decoded =
        await admin
          .auth()
          .verifyIdToken(
            token
          );

      const uid =
        decoded.uid;

      const email =
        decoded.email
          ?.trim()
          .toLowerCase();

      if (!email) {

        return res.status(400).json({
          error:
            "Email not found in Firebase account."
        });
      }

      /*
       * Find existing MongoDB user
       * by Firebase UID or email.
       */

      let user =
        await User.findOne({

          $or: [

            {
              firebaseUid:
                uid
            },

            {
              email:
                email
            }

          ]

        });

      /*
       * Create MongoDB user
       * if this is a new Firebase user.
       */

      if (!user) {

        const referralCode =
          await generateReferralCode();

        let referredBy = null;

        if (referralCodeInput) {

          const referrer =
            await User.findOne({
              referralCode:
                referralCodeInput
                  .trim()
                  .toUpperCase()
            });

          if (referrer) {
            referredBy = referrer._id;
          }
        }

        user =
          new User({

            email:
              email,

            firebaseUid:
              uid,

            password:
              undefined,

            isVerified:
              false,

            credits:
              0,

            hasPurchased:
              false,

            referralCode,

            referredBy

          });

      } else {

        /*
         * Link old email-based
         * account with Firebase.
         */

        if (
          !user.firebaseUid
        ) {

          user.firebaseUid =
            uid;

        }

        /*
         * Don't send OTP again
         * if already verified.
         */

        if (
          user.isVerified === true
        ) {

          return res.status(400).json({
            error:
              "Email is already verified."
          });
        }

      }

      /*
       * 60-second resend protection.
       */

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

      /*
       * Generate 6-digit OTP.
       */

      const otp =
        crypto
          .randomInt(
            100000,
            1000000
          )
          .toString();

      /*
       * Store only a SHA-256 hash,
       * not the actual OTP.
       */

      const otpHash =
        crypto
          .createHash(
            "sha256"
          )
          .update(otp)
          .digest("hex");

      user.otpHash =
        otpHash;

      user.otpExpires =
        new Date(
          Date.now() +
          10 * 60 * 1000
        );

      user.otpAttempts =
        0;

      user.otpLastSent =
        new Date();

      await user.save();

      /*
       * Send OTP through Brevo.
       */

      try {

        await sendBrevoOTP(
          email,
          otp
        );

      } catch (emailError) {

        console.error(
          "Brevo OTP error:",
          emailError
        );

        /*
         * Clear OTP if email
         * wasn't sent.
         */

        user.otpHash =
          null;

        user.otpExpires =
          null;

        user.otpLastSent =
          null;

        await user.save();

        return res.status(500).json({
          error:
            "Unable to send verification email."
        });
      }

      return res.json({

        success:
          true,

        message:
          "Verification code sent.",

        expiresIn:
          600

      });

    } catch (error) {

      console.error(
        "Send OTP error:",
        error
      );

      return res.status(401).json({
        error:
          "Unable to send verification code."
      });
    }
  }
);

/* ======================================================
   VERIFY OTP
   POST /auth/verify-otp
====================================================== */

router.post(
  "/verify-otp",
  async (req, res) => {

    try {

      const authHeader =
        req.headers.authorization;

      if (
        !authHeader ||
        !authHeader.startsWith(
          "Bearer "
        )
      ) {

        return res.status(401).json({
          error:
            "Missing Firebase token"
        });
      }

      const token =
        authHeader.split(" ")[1];

      const decoded =
        await admin
          .auth()
          .verifyIdToken(
            token
          );

      const uid =
        decoded.uid;

      const user =
        await User.findOne({

          firebaseUid:
            uid

        });

      if (!user) {

        return res.status(404).json({
          error:
            "User not found."
        });
      }

      if (
        user.isVerified === true
      ) {

        return res.json({

          success:
            true,

          message:
            "Email already verified."

        });
      }

      const {
        otp
      } = req.body;

      if (
        !otp
      ) {

        return res.status(400).json({
          error:
            "OTP is required."
        });
      }

      /*
       * Check expiry.
       */

      if (
        !user.otpExpires ||
        user.otpExpires.getTime() <
          Date.now()
      ) {

        return res.status(400).json({
          error:
            "OTP expired. Please request a new OTP."
        });
      }

      /*
       * Maximum 5 attempts.
       */

      if (
        user.otpAttempts >= 5
      ) {

        return res.status(429).json({
          error:
            "Too many incorrect attempts. Please request a new OTP."
        });
      }

      /*
       * Hash submitted OTP.
       */

      const submittedHash =
        crypto
          .createHash(
            "sha256"
          )
          .update(
            otp.toString().trim()
          )
          .digest("hex");

      /*
       * Compare hashes.
       */

      if (
        submittedHash !==
        user.otpHash
      ) {

        user.otpAttempts =
          (user.otpAttempts || 0) +
          1;

        await user.save();

        return res.status(400).json({
          error:
            "Invalid OTP."
        });
      }

      /*
       * OTP correct.
       */

      user.isVerified =
        true;

      user.otpHash =
        null;

      user.otpExpires =
        null;

      user.otpAttempts =
        0;

      user.otpLastSent =
        null;

      await user.save();

      /*
       * Mark Firebase email
       * as verified.
       */

      await admin
        .auth()
        .updateUser(
          uid,
          {
            emailVerified:
              true
          }
        );

      return res.json({

        success:
          true,

        message:
          "Email verified successfully!"

      });

    } catch (error) {

      console.error(
        "Verify OTP error:",
        error
      );

      return res.status(500).json({
        error:
          "Server error during OTP verification."
      });
    }
  }
);

/* ======================================================
   RESEND OTP
   POST /auth/resend-otp
====================================================== */

router.post(
  "/resend-otp",
  async (req, res) => {

    try {

      const authHeader =
        req.headers.authorization;

      if (
        !authHeader ||
        !authHeader.startsWith(
          "Bearer "
        )
      ) {

        return res.status(401).json({
          error:
            "Missing Firebase token"
        });
      }

      const token =
        authHeader.split(" ")[1];

      const decoded =
        await admin
          .auth()
          .verifyIdToken(
            token
          );

      const uid =
        decoded.uid;

      const user =
        await User.findOne({

          firebaseUid:
            uid

        });

      if (!user) {

        return res.status(404).json({
          error:
            "User not found."
        });
      }

      if (
        user.isVerified === true
      ) {

        return res.status(400).json({
          error:
            "Email is already verified."
        });
      }

      /*
       * 60-second protection.
       */

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
            `Please wait ${remaining} seconds.`,

          remaining

        });

      }

      /*
       * Generate new OTP.
       */

      const otp =
        crypto
          .randomInt(
            100000,
            1000000
          )
          .toString();

      user.otpHash =
        crypto
          .createHash(
            "sha256"
          )
          .update(otp)
          .digest("hex");

      user.otpExpires =
        new Date(
          Date.now() +
          10 * 60 * 1000
        );

      user.otpAttempts =
        0;

      user.otpLastSent =
        new Date();

      await user.save();

      /*
       * Send new OTP.
       */

      try {

        await sendBrevoOTP(
          user.email,
          otp
        );

      } catch (emailError) {

        console.error(
          "Brevo resend error:",
          emailError
        );

        user.otpHash =
          null;

        user.otpExpires =
          null;

        user.otpLastSent =
          null;

        await user.save();

        return res.status(500).json({
          error:
            "Unable to send OTP."
        });
      }

      return res.json({

        success:
          true,

        message:
          "New OTP sent.",

        remaining:
          60

      });

    } catch (error) {

      console.error(
        "Resend OTP error:",
        error
      );

      return res.status(500).json({
        error:
          "Unable to resend OTP."
      });
    }
  }
);

/* ======================================================
   EXPORT
====================================================== */

export default router;
```
