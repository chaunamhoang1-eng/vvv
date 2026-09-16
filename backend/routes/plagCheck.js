import express from "express";
import ApiUser from "../models/ApiUser.js";
import ApiOrder from "../models/ApiOrder.js";
import { sendApiOrderDiscordNotification } from "../services/discordWebhook.js";
import { requireApiKey } from "../middleware/requireApiKey.js";

const router = express.Router();

/* ===============================
   EXTRACT FILENAME
================================ */

function extractFilename(url) {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split("/").pop();

    if (!filename) return "document";

    return decodeURIComponent(filename);
  } catch {
    return "document";
  }
}

/* ===============================
   POST /check
================================ */

router.post("/check", requireApiKey, async (req, res) => {
  const user = req.apiUser;

  const {
    file_url,
    callback_url
  } = req.body;

  /* ===============================
     VALIDATE FILE URL
  =============================== */

  if (!file_url) {
    return res.status(400).json({
      success: false,
      error: "file_url required"
    });
  }

  let parsedURL;

  try {
    parsedURL = new URL(file_url);

    if (
      parsedURL.protocol !== "http:" &&
      parsedURL.protocol !== "https:"
    ) {
      throw new Error();
    }
  } catch {
    return res.status(400).json({
      success: false,
      error: "Invalid file_url"
    });
  }

  /* ===============================
     ATOMIC CREDIT DEDUCTION

     Deduct ONCE when API job
     is successfully accepted.
  =============================== */

  const updatedUser =
    await ApiUser.findOneAndUpdate(
      {
        _id: user._id,
        status: "active",
        credits: { $gt: 0 }
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

  if (!updatedUser) {
    return res.status(402).json({
      success: false,
      error: "Insufficient credits"
    });
  }

  try {
    /* ===============================
       EXTRACT FILENAME
    =============================== */

    const filename = extractFilename(file_url);

    /* ===============================
       CREATE API ORDER
    =============================== */

    const order =
      await ApiOrder.create({
        apiKey: user.apiKey,

        callbackURL:
          callback_url ||
          user.callbackURL ||
          null,

        fileURL: file_url,

        filename,

        status: "pending",

        processing: false,

        creditDeducted: true
      });

    console.log(
      "✅ API ORDER CREATED:",
      order._id.toString()
    );

    /* ===============================
       DISCORD ADMIN NOTIFICATION

       Notification contains:
       - Order ID
       - Filename
       - Status

       NO credits
       NO API key
       NO callback URL
       NO file URL
    =============================== */

    sendApiOrderDiscordNotification(order);

    /* ===============================
       API RESPONSE
    =============================== */

    return res.status(202).json({
      success: true,

      message: "File submitted successfully",

      order_id: order._id,

      status: "pending",

      credits_left: updatedUser.credits
    });

  } catch (err) {

    /* ===============================
       REFUND CREDIT IF ORDER
       CREATION FAILS
    =============================== */

    await ApiUser.updateOne(
      { _id: user._id },
      {
        $inc: {
          credits: 1,
          totalUsed: -1
        }
      }
    );

    console.error(
      "❌ API ORDER CREATION ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      error: "Failed to create API order"
    });
  }
});

export default router;
