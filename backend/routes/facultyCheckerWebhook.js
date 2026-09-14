import crypto from "crypto";

import Order from "../models/Order.js";
import ApiOrder from "../models/ApiOrder.js";

import { updateDiscordOrder } from "../utils/discordWebhook.js";


/* ==================================================
   CONFIG
================================================== */

const FC_WEBHOOK_SECRET =
  process.env.FC_WEBHOOK_SECRET;


/* ==================================================
   VERIFY FACULTY CHECKER SIGNATURE
================================================== */

function verifyFacultyCheckerWebhook(req) {

  console.log(
    "\n🔐 [FC WEBHOOK] Starting signature verification..."
  );


  if (!FC_WEBHOOK_SECRET) {

    console.error(
      "❌ [FC WEBHOOK] FC_WEBHOOK_SECRET is missing!"
    );

    return false;

  }


  const signature =
    req.headers["x-fc-signature"];


  console.log(
    "🔐 [FC WEBHOOK] X-FC-Signature:",
    signature
  );


  if (!signature) {

    console.error(
      "❌ [FC WEBHOOK] Missing X-FC-Signature"
    );

    return false;

  }


  let timestamp = null;
  let receivedSignature = null;


  const parts =
    signature.split(",");


  for (const part of parts) {

    const [key, value] =
      part.split("=");


    if (key === "t") {

      timestamp =
        value;

    }


    if (key === "v1") {

      receivedSignature =
        value;

    }

  }


  console.log(
    "🔐 [FC WEBHOOK] Parsed signature:",
    {
      timestamp,
      receivedSignature
    }
  );


  if (
    !timestamp ||
    !receivedSignature
  ) {

    console.error(
      "❌ [FC WEBHOOK] Invalid signature format"
    );

    return false;

  }


  /* ==================================================
     TIMESTAMP PROTECTION
  ================================================== */

  const timestampNumber =
    Number(timestamp);


  const currentTime =
    Math.floor(
      Date.now() / 1000
    );


  const difference =
    Math.abs(
      currentTime -
      timestampNumber
    );


  console.log(
    "⏱️ [FC WEBHOOK] Timestamp:",
    {
      currentTime,
      webhookTime:
        timestampNumber,
      difference
    }
  );


  if (
    !Number.isFinite(
      timestampNumber
    )
  ) {

    console.error(
      "❌ [FC WEBHOOK] Invalid timestamp"
    );

    return false;

  }


  if (
    difference > 300
  ) {

    console.error(
      "❌ [FC WEBHOOK] Timestamp expired"
    );

    return false;

  }


  /* ==================================================
     RAW BODY
  ================================================== */

  const rawBody =
    req.rawBody;


  if (!rawBody) {

    console.error(
      "❌ [FC WEBHOOK] RAW BODY MISSING"
    );

    return false;

  }


  console.log(
    "📦 [FC WEBHOOK] Raw body length:",
    rawBody.length
  );


  /* ==================================================
     HMAC
  ================================================== */

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        FC_WEBHOOK_SECRET
      )
      .update(
        `${timestamp}.${rawBody}`
      )
      .digest("hex");


  console.log(
    "🔐 [FC WEBHOOK] Expected signature:",
    expectedSignature
  );

  console.log(
    "🔐 [FC WEBHOOK] Received signature:",
    receivedSignature
  );


  /* ==================================================
     CONSTANT-TIME COMPARISON
  ================================================== */

  try {

    const expectedBuffer =
      Buffer.from(
        expectedSignature,
        "utf8"
      );


    const receivedBuffer =
      Buffer.from(
        receivedSignature,
        "utf8"
      );


    if (
      expectedBuffer.length !==
      receivedBuffer.length
    ) {

      console.error(
        "❌ [FC WEBHOOK] Signature length mismatch"
      );

      return false;

    }


    const valid =
      crypto.timingSafeEqual(
        expectedBuffer,
        receivedBuffer
      );


    if (valid) {

      console.log(
        "✅ [FC WEBHOOK] SIGNATURE VALID"
      );

    } else {

      console.error(
        "❌ [FC WEBHOOK] SIGNATURE INVALID"
      );

    }


    return valid;


  } catch (err) {

    console.error(
      "❌ [FC WEBHOOK] Signature comparison error:",
      err.message
    );

    return false;

  }

}


/* ==================================================
   FACULTY CHECKER WEBHOOK
================================================== */

async function facultyCheckerWebhook(
  req,
  res
) {

  console.log(
    "\n\n========================================"
  );

  console.log(
    "🚨 [FC WEBHOOK] WEBHOOK RECEIVED"
  );

  console.log(
    "🕐 Time:",
    new Date().toISOString()
  );

  console.log(
    "🌐 IP:",
    req.ip
  );

  console.log(
    "========================================\n"
  );


  /* ==================================================
     HEADERS
  ================================================== */

  console.log(
    "📋 [FC WEBHOOK] Headers:",
    {
      contentType:
        req.headers["content-type"],

      signature:
        req.headers["x-fc-signature"],

      userAgent:
        req.headers["user-agent"]
    }
  );


  /* ==================================================
     RAW BODY
  ================================================== */

  console.log(
    "📦 [FC WEBHOOK] Raw body exists:",
    !!req.rawBody
  );


  if (req.rawBody) {

    console.log(
      "📦 [FC WEBHOOK] Raw body:"
    );

    console.log(
      req.rawBody
    );

  }


  /* ==================================================
     VERIFY SIGNATURE
  ================================================== */

  const valid =
    verifyFacultyCheckerWebhook(
      req
    );


  if (!valid) {

    console.error(
      "❌ [FC WEBHOOK] REJECTING REQUEST"
    );

    return res
      .status(400)
      .send("Invalid signature");

  }


  console.log(
    "✅ [FC WEBHOOK] Signature verified successfully"
  );


  /* ==================================================
     PARSE JSON
  ================================================== */

  let payload;


  try {

    payload =
      JSON.parse(
        req.rawBody
      );

  } catch (err) {

    console.error(
      "❌ [FC WEBHOOK] JSON PARSE ERROR:",
      err.message
    );

    return res
      .status(400)
      .send("Invalid JSON");

  }


  /* ==================================================
     COMPLETE PAYLOAD LOG
  ================================================== */

  console.log(
    "\n========================================"
  );

  console.log(
    "📦 [FC WEBHOOK] COMPLETE PAYLOAD"
  );

  console.log(
    JSON.stringify(
      payload,
      null,
      2
    )
  );

  console.log(
    "========================================\n"
  );


  /* ==================================================
     DATA
  ================================================== */

  const data =
    payload?.data;


  console.log(
    "📊 [FC WEBHOOK] data:",
    JSON.stringify(
      data,
      null,
      2
    )
  );


  if (!data) {

    console.warn(
      "⚠️ [FC WEBHOOK] No data field found"
    );

    return res
      .status(200)
      .send("OK");

  }


  /* ==================================================
     SUBMISSION ID
  ================================================== */

  const submissionId =
    data.id ||
    data.submission_id;


  console.log(
    "🆔 [FC WEBHOOK] Submission ID:",
    submissionId
  );


  /* ==================================================
     REFERENCE
  ================================================== */

  const reference =
    data.reference;


  console.log(
    "🔖 [FC WEBHOOK] Reference:",
    reference
  );


  if (!reference) {

    console.error(
      "❌ [FC WEBHOOK] No reference received"
    );

    return res
      .status(200)
      .send("OK");

  }


  /* ==================================================
     STATUS
  ================================================== */

  const status =
    data.status;


  console.log(
    "📊 [FC WEBHOOK] STATUS:",
    status
  );


  /* ==================================================
     FIND WEBSITE ORDER OR API ORDER
  ================================================== */

  console.log(
    "🔎 [FC WEBHOOK] Searching API Order first:",
    reference
  );


  let apiOrder =
    await ApiOrder.findById(
      reference
    );


  let order = null;

  let orderType = null;


  if (apiOrder) {

    orderType =
      "api";

    console.log(
      "✅ [FC WEBHOOK] API ORDER FOUND:",
      {
        orderId:
          apiOrder._id.toString(),

        status:
          apiOrder.status,

        processing:
          apiOrder.processing,

        historyId:
          apiOrder.historyId
      }
    );

  } else {

    console.log(
      "🔎 [FC WEBHOOK] API order not found. Searching website Order:",
      reference
    );


    order =
      await Order.findById(
        reference
      );


    if (order) {

      orderType =
        "website";

      console.log(
        "✅ [FC WEBHOOK] WEBSITE ORDER FOUND:",
        {
          orderId:
            order._id.toString(),

          status:
            order.status,

          processing:
            order.processing,

          historyId:
            order.historyId
        }
      );

    }

  }


  if (
    !apiOrder &&
    !order
  ) {

    console.error(
      "❌ [FC WEBHOOK] ORDER NOT FOUND:",
      reference
    );

    /*
      Return 200 so Faculty Checker does not
      repeatedly retry an unknown reference.
    */

    return res
      .status(200)
      .send("OK");

  }


  /* ==================================================
     COMPLETED
  ================================================== */

  if (
    status === "completed"
  ) {

    console.log(
      "\n🎉 [FC WEBHOOK] SUBMISSION COMPLETED"
    );


    console.log(
      "🔍 [FC WEBHOOK] COMPLETED DATA:"
    );

    console.log(
      JSON.stringify(
        data,
        null,
        2
      )
    );


    /* ==================================================
       REPORTS
    ================================================== */

    const reports =
      data.reports ||
      data.report_links ||
      {};


    console.log(
      "📄 [FC WEBHOOK] Reports:",
      JSON.stringify(
        reports,
        null,
        2
      )
    );


    /* ==================================================
       AI REPORT
    ================================================== */

    const aiReportUrl =
      reports.ai ||
      reports.ai_report ||
      reports.ai_report_url ||
      data.ai_report_url ||
      null;


    /* ==================================================
       PLAGIARISM REPORT
    ================================================== */

    const plagReportUrl =
      reports.plagiarism ||
      reports.plagiarism_report ||
      reports.similarity ||
      reports.similarity_report_url ||
      data.similarity_report_url ||
      null;


    /* ==================================================
       SCORES
    ================================================== */

    const aiIndex =
      data.ai_index ??
      data.ai_score ??
      data.scores?.ai ??
      null;


    const similarityIndex =
      data.similarity_index ??
      data.similarity_score ??
      data.scores?.similarity ??
      null;


    console.log(
      "🤖 [FC WEBHOOK] AI REPORT URL:",
      aiReportUrl
    );

    console.log(
      "🤖 [FC WEBHOOK] AI INDEX:",
      aiIndex
    );

    console.log(
      "📝 [FC WEBHOOK] PLAG REPORT URL:",
      plagReportUrl
    );

    console.log(
      "📝 [FC WEBHOOK] SIMILARITY INDEX:",
      similarityIndex
    );


    /* ==================================================
       API ORDER
    ================================================== */

    if (
      orderType === "api"
    ) {

      /* ----------------------------------------------
         DUPLICATE PROTECTION
      ---------------------------------------------- */

      if (
        apiOrder.status ===
        "completed"
      ) {

        console.log(
          "ℹ️ [FC WEBHOOK] API order already completed."
        );

        return res
          .status(200)
          .send("OK");

      }


      /* ----------------------------------------------
         UPDATE API ORDER
      ---------------------------------------------- */

      console.log(
        "💾 [FC WEBHOOK] Updating API order..."
      );


      const updatedApiOrder =
        await ApiOrder.findByIdAndUpdate(

          reference,

          {

            historyId:
              submissionId,

            status:
              "completed",

            processing:
              false,

            completedAt:
              new Date(),

            aiReport: {

              filename:
                "AI Report",

              storedName:
                aiReportUrl,

              percentage:
                aiIndex

            },


            plagReport: {

              filename:
                "Plagiarism Report",

              storedName:
                plagReportUrl,

              percentage:
                similarityIndex

            },

            creditDeducted:
              true

          },

          {
            new:
              true
          }

        );


      console.log(
        "✅ [FC WEBHOOK] API ORDER UPDATED:",
        {
          orderId:
            updatedApiOrder?._id,

          status:
            updatedApiOrder?.status,

          processing:
            updatedApiOrder?.processing,

          aiReport:
            updatedApiOrder?.aiReport,

          plagReport:
            updatedApiOrder?.plagReport
        }
      );


      /*
        API customer callback.

        We will add callback handling separately
        once the exact webhook payload fields are
        confirmed.
      */


      console.log(
        "\n🎉 [FC WEBHOOK] API PROCESSING COMPLETE"
      );


      return res
        .status(200)
        .send("OK");

    }


    /* ==================================================
       WEBSITE ORDER
    ================================================== */

    if (
      orderType === "website"
    ) {

      /* ----------------------------------------------
         DUPLICATE PROTECTION
      ---------------------------------------------- */

      if (
        order.status ===
        "completed"
      ) {

        console.log(
          "ℹ️ [FC WEBHOOK] Website order already completed."
        );

        return res
          .status(200)
          .send("OK");

      }


      /* ----------------------------------------------
         UPDATE WEBSITE ORDER
      ---------------------------------------------- */

      console.log(
        "💾 [FC WEBHOOK] Updating website order..."
      );


      const updatedOrder =
        await Order.findByIdAndUpdate(

          reference,

          {

            historyId:
              submissionId,

            status:
              "completed",

            processing:
              false,

            completedAt:
              new Date(),

            completedBy:
              "api",


            aiReport: {

              filename:
                "AI Report",

              storedName:
                aiReportUrl,

              percentage:
                aiIndex

            },


            plagReport: {

              filename:
                "Plagiarism Report",

              storedName:
                plagReportUrl,

              percentage:
                similarityIndex

            },

            creditDeducted:
              true

          },

          {
            new:
              true
          }

        );


      console.log(
        "✅ [FC WEBHOOK] WEBSITE ORDER UPDATED:",
        {
          orderId:
            updatedOrder?._id,

          status:
            updatedOrder?.status,

          processing:
            updatedOrder?.processing,

          aiReport:
            updatedOrder?.aiReport,

          plagReport:
            updatedOrder?.plagReport
        }
      );


      /* ==================================================
         DISCORD
      ================================================== */

      if (
        updatedOrder
          ?.discord_messages
          ?.length
      ) {

        console.log(
          "🔄 [FC WEBHOOK] Updating Discord..."
        );


        try {

          await updateDiscordOrder(
            updatedOrder,
            updatedOrder.discord_messages
          );


          console.log(
            "✅ [FC WEBHOOK] Discord updated successfully"
          );


        } catch (err) {

          console.error(
            "❌ [FC WEBHOOK] Discord update error:",
            err
          );

        }

      } else {

        console.log(
          "⚠️ [FC WEBHOOK] No Discord messages stored."
        );

      }


      console.log(
        "\n🎉 [FC WEBHOOK] WEBSITE PROCESSING COMPLETE"
      );


      return res
        .status(200)
        .send("OK");

    }


  }


  /* ==================================================
     FAILED
  ================================================== */

  if (
    status === "failed"
  ) {

    console.error(
      "\n❌ [FC WEBHOOK] SUBMISSION FAILED"
    );


    console.error(
      "📦 Failure payload:",
      JSON.stringify(
        data,
        null,
        2
      )
    );


    if (
      orderType === "api"
    ) {

      await ApiOrder.findByIdAndUpdate(

        reference,

        {

          historyId:
            submissionId,

          status:
            "failed",

          processing:
            false

        }

      );


      console.log(
        "💾 [FC WEBHOOK] API order marked failed:",
        reference
      );

    } else {

      await Order.findByIdAndUpdate(

        reference,

        {

          historyId:
            submissionId,

          status:
            "failed",

          processing:
            false

        }

      );


      console.log(
        "💾 [FC WEBHOOK] Website order marked failed:",
        reference
      );

    }


    return res
      .status(200)
      .send("OK");

  }


  /* ==================================================
     OTHER STATUS
  ================================================== */

  console.log(
    "⏳ [FC WEBHOOK] Non-final status:",
    status
  );

  console.log(
    "ℹ️ [FC WEBHOOK] Waiting for completion..."
  );


  return res
    .status(200)
    .send("OK");

}


/* ==================================================
   EXPORT
================================================== */

export default facultyCheckerWebhook;
