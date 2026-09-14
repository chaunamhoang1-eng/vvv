
import axios from "axios";
import FormData from "form-data";
import Order from "../models/Order.js";


/* ======================================================
   FACULTY CHECKER CONFIG
====================================================== */

const FC_BASE_URL =
  "https://facultychecker.com/api/v1";

const FC_API_TOKEN =
  process.env.FC_API_TOKEN;


/* ======================================================
   DOWNLOAD FILE
====================================================== */

async function downloadFile(
  fileURL
) {

  console.log(
    "\n⬇️ [FC] DOWNLOADING FILE"
  );

  console.log(
    "🔗 File URL:",
    fileURL
  );


  const response =
    await axios.get(
      fileURL,
      {

        responseType:
          "arraybuffer",

        timeout:
          120000,

        validateStatus:
          () => true

      }
    );


  console.log(
    "📥 [FC] FILE DOWNLOAD RESPONSE:",
    {

      status:
        response.status,

      contentType:
        response.headers[
          "content-type"
        ],

      size:
        response.data?.length

    }
  );


  if (
    response.status < 200 ||
    response.status >= 300
  ) {

    throw new Error(
      `Could not download file. HTTP ${response.status}`
    );

  }


  return {

    buffer:
      Buffer.from(
        response.data
      ),

    contentType:
      response.headers[
        "content-type"
      ] ||
      "application/octet-stream"

  };

}


/* ======================================================
   SUBMIT TO FACULTY CHECKER
====================================================== */

async function submitToFacultyChecker(
  orderId,
  fileURL
) {

  console.log(
    "\n========================================"
  );

  console.log(
    "📤 [FC] STARTING SUBMISSION"
  );

  console.log(
    "🆔 Order ID:",
    orderId.toString()
  );

  console.log(
    "🔗 File URL:",
    fileURL
  );

  console.log(
    "========================================"
  );


  /* ==================================================
     DOWNLOAD FILE
  ================================================== */

  const file =
    await downloadFile(
      fileURL
    );


  /* ==================================================
     DETERMINE FILENAME
  ================================================== */

  let filename =
    `submission-${orderId}.pdf`;


  try {

    const url =
      new URL(
        fileURL
      );


    const lastPart =
      url.pathname
        .split("/")
        .pop();


    if (lastPart) {

      filename =
        decodeURIComponent(
          lastPart
        );

    }

  } catch (err) {

    console.warn(
      "⚠️ [FC] Could not determine filename."
    );

    console.warn(
      "Using:",
      filename
    );

  }


  console.log(
    "📄 [FC] Filename:",
    filename
  );


  /* ==================================================
     VALIDATE FILE TYPE
  ================================================== */

  const lowerFilename =
    filename.toLowerCase();


  if (
    !lowerFilename.endsWith(".pdf") &&
    !lowerFilename.endsWith(".docx")
  ) {

    throw new Error(
      "Faculty Checker accepts PDF or DOCX files only."
    );

  }


  /* ==================================================
     CREATE FORM DATA
  ================================================== */

  const form =
    new FormData();


  /*
    Faculty Checker sends `reference`
    back to our webhook.

    We use Order ID so we can find
    the correct MongoDB order.
  */

  form.append(
    "student_name",
    orderId.toString()
  );


  form.append(
    "reference",
    orderId.toString()
  );


  form.append(
    "document",
    file.buffer,
    {

      filename,

      contentType:
        file.contentType

    }
  );


  /* ==================================================
     IDEMPOTENCY KEY
  ================================================== */

  const idempotencyKey =
    `order-${orderId.toString()}`;


  console.log(
    "🔑 [FC] Idempotency-Key:",
    idempotencyKey
  );


  console.log(
    "🔖 [FC] Reference:",
    orderId.toString()
  );


  console.log(
    "📦 [FC] Uploading file to Faculty Checker..."
  );


  /* ==================================================
     POST /submissions
  ================================================== */

  const response =
    await axios.post(

      `${FC_BASE_URL}/submissions`,

      form,

      {

        headers: {

          ...form.getHeaders(),

          Authorization:
            `Bearer ${FC_API_TOKEN}`,

          "Idempotency-Key":
            idempotencyKey

        },


        timeout:
          120000,


        maxContentLength:
          Infinity,


        maxBodyLength:
          Infinity,


        validateStatus:
          () => true

      }

    );


  /* ==================================================
     LOG RESPONSE
  ================================================== */

  console.log(
    "\n========================================"
  );

  console.log(
    "📥 [FC] SUBMISSION RESPONSE"
  );

  console.log(
    "HTTP STATUS:",
    response.status
  );

  console.log(
    "RESPONSE:"
  );

  console.log(
    JSON.stringify(
      response.data,
      null,
      2
    )
  );

  console.log(
    "========================================\n"
  );


  /* ==================================================
     ERROR
  ================================================== */

  if (
    response.status < 200 ||
    response.status >= 300
  ) {

    console.error(
      "❌ [FC] SUBMISSION FAILED"
    );


    console.error(
      "Error code:",
      response.data?.error?.code
    );


    console.error(
      "Error message:",
      response.data?.error?.message
    );


    throw new Error(
      response.data?.error?.message ||
      `Faculty Checker submission failed (${response.status})`
    );

  }


  /* ==================================================
     RETURN FACULTY CHECKER RESPONSE
  ================================================== */

  return response.data;

}


/* ======================================================
   MAIN PROCESS
====================================================== */

export async function processDocument(
  orderId,
  fileURL
) {

  console.log(
    "\n\n========================================"
  );

  console.log(
    "⚙️ [FC] PROCESS DOCUMENT"
  );

  console.log(
    "🆔 Order ID:",
    orderId.toString()
  );

  console.log(
    "========================================"
  );


  /* ==================================================
     CHECK API TOKEN
  ================================================== */

  if (!FC_API_TOKEN) {

    console.error(
      "❌ [FC] FC_API_TOKEN IS NOT SET"
    );

    return;

  }


  /* ==================================================
     FIND ORDER
  ================================================== */

  const order =
    await Order.findById(
      orderId
    );


  if (!order) {

    console.error(
      "❌ [FC] ORDER NOT FOUND:",
      orderId.toString()
    );

    return;

  }


  console.log(
    "📋 [FC] Current order:",
    {

      id:
        order._id.toString(),

      status:
        order.status,

      processing:
        order.processing,

      historyId:
        order.historyId

    }
  );


  /* ==================================================
     DON'T PROCESS FINISHED ORDERS
  ================================================== */

  if (
    order.status === "completed" ||
    order.status === "failed"
  ) {

    console.log(
      "ℹ️ [FC] Order already finished. Skipping."
    );

    return;

  }


  /* ==================================================
     SUBMIT
  ================================================== */

  try {

    const submit =
      await submitToFacultyChecker(
        orderId,
        fileURL
      );


    /* ==================================================
       FACULTY CHECKER SUBMISSION ID
    ================================================== */

    const submissionId =
      submit?.data?.id;


    console.log(
      "🆔 [FC] Submission ID:",
      submissionId
    );


    if (!submissionId) {

      console.error(
        "❌ [FC] NO SUBMISSION ID RETURNED"
      );


      console.error(
        "📦 Full response:",
        JSON.stringify(
          submit,
          null,
          2
        )
      );


      throw new Error(
        "Faculty Checker did not return submission ID."
      );

    }


    /* ==================================================
       UPDATE ORDER
    ================================================== */

    const updatedOrder =
      await Order.findByIdAndUpdate(

        orderId,

        {

          /*
            Keeping your existing MongoDB
            field name `historyId`.

            It now stores Faculty Checker's
            submission ID.
          */

          historyId:
            submissionId,

          status:
            "processing",

          processing:
            true

        },

        {
          new:
            true
        }

      );


    console.log(
      "\n========================================"
    );

    console.log(
      "✅ [FC] SUBMISSION SUCCESSFUL"
    );

    console.log(
      "🆔 Order:",
      orderId.toString()
    );

    console.log(
      "🆔 Faculty Checker Submission:",
      submissionId
    );

    console.log(
      "📊 Order Status:",
      updatedOrder?.status
    );

    console.log(
      "⚙️ Processing:",
      updatedOrder?.processing
    );

    console.log(
      "========================================"
    );


    /* ==================================================
       NO POLLING
    ================================================== */

    console.log(
      "\n⏳ [FC] WAITING FOR WEBHOOK..."
    );

    console.log(
      "📡 Faculty Checker will call:"
    );

    console.log(
      "/api/webhooks/faculty-checker"
    );


    console.log(
      "🆔 Waiting for submission:",
      submissionId
    );


    /*
      IMPORTANT:

      We DO NOT poll here.

      Faculty Checker will send the result
      to our webhook when processing finishes.
    */


    return;


  } catch (err) {

    /* ==================================================
       SUBMISSION ERROR
    ================================================== */

    console.error(
      "\n❌ [FC] PROCESS DOCUMENT ERROR"
    );


    console.error(
      "🆔 Order:",
      orderId.toString()
    );


    console.error(
      "Message:",
      err.message
    );


    console.error(
      "Stack:",
      err.stack
    );


    /* ==================================================
       MARK ORDER FAILED
    ================================================== */

    await Order.findByIdAndUpdate(

      orderId,

      {

        status:
          "failed",

        processing:
          false

      }

    );


    console.log(
      "💾 [FC] Order marked as failed:",
      orderId.toString()
    );

  }

}

