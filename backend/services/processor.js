import axios from "axios";
import crypto from "crypto";
import Order from "../models/Order.js";
import { updateDiscordOrder } from "../utils/discordWebhook.js";

/* ================= CONFIG ================= */

const TT_BASE_URL =
  "https://origincheckai.com/api/v1/agent";

const TT_API_KEY =
  process.env.TT_API_KEY;

const TT_API_SECRET =
  process.env.TT_API_SECRET;

const POLL_INTERVAL =
  60_000; // 60 seconds

const MAX_TRIES =
  50; // 50 attempts ~ 50 minutes


/* ================= SIGNATURE ================= */

function createSignature(
  timestamp,
  nonce,
  body = ""
) {

  return crypto
    .createHmac(
      "sha256",
      TT_API_SECRET
    )
    .update(
      timestamp +
      nonce +
      body
    )
    .digest("hex");

}


/* ================= SIGNED SUBMIT ================= */

async function signedPost(
  endpoint,
  payload
) {

  const timestamp =
    Math.floor(
      Date.now() / 1000
    ).toString();

  const nonce =
    crypto.randomBytes(8)
      .toString("hex");

  const body =
    JSON.stringify(payload);

  const signature =
    createSignature(
      timestamp,
      nonce,
      body
    );


  const res =
    await axios.post(
      `${TT_BASE_URL}${endpoint}`,
      body,
      {

        headers: {

          "X-Api-Key":
            TT_API_KEY,

          "X-Timestamp":
            timestamp,

          "X-Nonce":
            nonce,

          "X-Signature":
            signature,

          "Content-Type":
            "application/json"

        },

        timeout:
          60_000,

        validateStatus:
          () => true

      }
    );


  console.log(
    "📤 TURNITIN SUBMIT RESPONSE:",
    {

      httpStatus:
        res.status,

      data:
        res.data

    }
  );


  if (
    !res.data ||
    res.data.success !== true
  ) {

    throw new Error(
      res.data?.error?.message ||
      "Submit failed"
    );

  }


  return res.data;

}


/* ================= FETCH RESULT ================= */

async function getResult(
  historyId
) {

  try {

    const res =
      await axios.get(
        `${TT_BASE_URL}/check/result`,
        {

          params: {
            history_id:
              historyId
          },

          headers: {
            "X-Api-Key":
              TT_API_KEY
          },

          timeout:
            30_000,

          validateStatus:
            () => true

        }
      );


    return res.data;


  } catch (err) {

    console.error(
      "⚠️ TURNITIN POLL ERROR:",
      err.message
    );

    return null;

  }

}


/* ================= MAIN PROCESS ================= */

export async function processDocument(
  orderId,
  fileURL
) {

  console.log(
    "⚙️ TURNITIN SUBMITTING:",
    orderId.toString()
  );


  const order =
    await Order.findById(
      orderId
    );


  if (!order) {
    return;
  }


  if (
    order.status ===
      "completed" ||
    order.status ===
      "failed"
  ) {

    return;

  }


  /* ==================================================
     SUBMIT FILE
  ================================================== */

  console.log(
    "📦 SUBMIT PAYLOAD:",
    {

      file_url:
        fileURL,

      external_order_id:
        orderId.toString()

    }
  );


  const submit =
    await signedPost(
      "/check/submit",
      {

        file_url:
          fileURL,

        external_order_id:
          orderId.toString()

      }
    );


  const historyId =
    submit.data.history_id;


  await Order.findByIdAndUpdate(
    orderId,
    {

      historyId,

      status:
        "processing",

      processing:
        true

    }
  );


  console.log(
    "⏳ POLLING START:",
    historyId
  );


  await new Promise(
    r =>
      setTimeout(
        r,
        POLL_INTERVAL
      )
  );


  /* ==================================================
     POLLING LOOP
  ================================================== */

  for (
    let i = 1;
    i <= MAX_TRIES;
    i++
  ) {

    console.log(
      `🔁 POLL ${i}/${MAX_TRIES}`
    );


    const res =
      await getResult(
        historyId
      );


    if (
      !res ||
      !res.success
    ) {

      console.warn(
        "⚠️ TEMP ERROR, RETRYING..."
      );


      await new Promise(
        r =>
          setTimeout(
            r,
            POLL_INTERVAL
          )
      );


      continue;

    }


    const status =
      res.data.status;


    /* ==================================================
       COMPLETED
       
       IMPORTANT:
       NO CREDIT DEDUCTION HERE.

       Credit was already deducted
       when the user uploaded the file.
    ================================================== */

    if (
      status ===
      "completed"
    ) {

      const result =
        res.data.result;


      const updatedOrder =
        await Order.findByIdAndUpdate(

          orderId,

          {

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
                result.ai_report_url,

              percentage:
                result.ai_index

            },


            plagReport: {

              filename:
                "Plagiarism Report",

              storedName:
                result.similarity_report_url,

              percentage:
                result.similarity_index

            },


            /*
              Credit was already deducted
              during upload.
            */

            creditDeducted:
              true

          },

          {
            new:
              true
          }

        );


      console.log(
        "🎉 COMPLETED BY API:",
        orderId.toString()
      );


      /* ==================================================
         UPDATE DISCORD EMBED
      ================================================== */

      if (
        updatedOrder
          ?.discord_messages
          ?.length
      ) {

        console.log(
          "🔄 Updating Discord embed..."
        );


        try {

          await updateDiscordOrder(
            updatedOrder,
            updatedOrder.discord_messages
          );

        } catch (err) {

          console.error(
            "❌ Discord update error:",
            err
          );

        }

      } else {

        console.log(
          "⚠️ No Discord message stored for update."
        );

      }


      return;

    }


    /* ==================================================
       FAILED
    ================================================== */

    if (
      status === "failed" ||
      status === "timeout"
    ) {

      await Order.findByIdAndUpdate(
        orderId,
        {

          status,

          processing:
            false

        }
      );


      console.error(
        "❌ TURNITIN FAILED:",
        status
      );


      return;

    }


    await new Promise(
      r =>
        setTimeout(
          r,
          POLL_INTERVAL
        )
    );

  }


  /* ==================================================
     TIMEOUT
  ================================================== */

  await Order.findByIdAndUpdate(
    orderId,
    {

      status:
        "timeout",

      processing:
        false

    }
  );


  console.error(
    "⏰ TURNITIN POLL TIMEOUT:",
    orderId.toString()
  );

}
