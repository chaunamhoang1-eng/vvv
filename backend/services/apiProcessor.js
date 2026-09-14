// backend/services/apiProcessor.js

import axios from "axios";
import FormData from "form-data";
import ApiOrder from "../models/ApiOrder.js";

const FC_BASE_URL =
  "https://facultychecker.com/api/v1";

const FC_API_TOKEN =
  process.env.FC_API_TOKEN;


/* ======================================================
   DOWNLOAD CUSTOMER FILE
====================================================== */

async function downloadFile(fileURL) {

  console.log(
    "\n⬇️ [API FC] DOWNLOADING CUSTOMER FILE"
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
    "📥 [API FC] FILE DOWNLOAD RESPONSE:",
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
      `Could not download customer file. HTTP ${response.status}`
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
   EXTRACT FILENAME FROM URL
====================================================== */

function extractFilename(fileURL) {

  try {

    const url =
      new URL(fileURL);

    const lastPart =
      url.pathname
        .split("/")
        .pop();

    if (
      lastPart &&
      /\.[a-z0-9]+$/i.test(lastPart)
    ) {

      return decodeURIComponent(
        lastPart
      );

    }

  } catch (err) {

    console.warn(
      "⚠️ [API FC] Could not extract filename from URL"
    );

  }


  return null;

}


/* ======================================================
   DETERMINE FILE TYPE
====================================================== */

function determineFileType(filename) {

  const lower =
    filename.toLowerCase();


  if (
    lower.endsWith(".docx")
  ) {

    return {
      extension: ".docx",

      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    };

  }


  if (
    lower.endsWith(".pdf")
  ) {

    return {
      extension: ".pdf",

      contentType:
        "application/pdf"
    };

  }


  return null;

}


/* ======================================================
   MAIN API PROCESSOR
====================================================== */

export async function processApiDocument(
  orderId,
  fileURL,
  options = {}
) {

  console.log(
    "\n\n========================================"
  );

  console.log(
    "⚙️ [API FC] PROCESSING API ORDER"
  );

  console.log(
    "🆔 API Order:",
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
     CHECK API TOKEN
  ================================================== */

  if (!FC_API_TOKEN) {

    throw new Error(
      "FC_API_TOKEN is not configured."
    );

  }


  /* ==================================================
     FIND API ORDER
  ================================================== */

  const order =
    await ApiOrder.findById(
      orderId
    );


  if (!order) {

    throw new Error(
      "API order not found."
    );

  }


  console.log(
    "📋 [API FC] Current order:",
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
     DOWNLOAD FILE
  ================================================== */

  const file =
    await downloadFile(
      fileURL
    );


  /* ==================================================
     DETERMINE FILENAME
     
     First try URL.
     
     If URL doesn't contain an extension,
     use a safe fallback based on content type.
  ================================================== */

  let filename =
    extractFilename(
      fileURL
    );


  if (!filename) {

    const contentType =
      file.contentType.toLowerCase();


    if (
      contentType.includes(
        "wordprocessingml.document"
      )
    ) {

      filename =
        `submission-${orderId}.docx`;

    } else if (
      contentType.includes(
        "pdf"
      )
    ) {

      filename =
        `submission-${orderId}.pdf`;

    } else {

      throw new Error(
        "Could not determine whether the customer file is PDF or DOCX. The file URL must contain a .pdf or .docx filename."
      );

    }

  }


  console.log(
    "📄 [API FC] Filename:",
    filename
  );


  /* ==================================================
     DETERMINE FACULTY CHECKER CONTENT TYPE
     
     IMPORTANT:
     DOCX may be reported by storage as
     application/zip because DOCX is ZIP-based.

     We use the actual filename for the
     Faculty Checker MIME type.
  ================================================== */

  const fileType =
    determineFileType(
      filename
    );


  if (!fileType) {

    throw new Error(
      "Faculty Checker accepts PDF or DOCX files only."
    );

  }


  console.log(
    "📦 [API FC] Faculty Checker content type:",
    fileType.contentType
  );

  console.log(
    "📦 [API FC] Downloaded content type:",
    file.contentType
  );

  console.log(
    "📦 [API FC] File size:",
    file.buffer.length,
    "bytes"
  );


  /* ==================================================
     CREATE FORM DATA
  ================================================== */

  const form =
    new FormData();


  /* ==================================================
     STUDENT NAME
  ================================================== */

  const studentName =
    options.studentName ||
    orderId.toString();


  form.append(
    "student_name",
    studentName
  );


  /* ==================================================
     REFERENCE
     
     Faculty Checker returns this value
     in the webhook.

     Use API customer's reference if supplied.
     Otherwise use our ApiOrder ID.
  ================================================== */

  const reference =
    options.reference ||
    orderId.toString();


  form.append(
    "reference",
    reference
  );


  /* ==================================================
     DOCUMENT
  ================================================== */

  form.append(
    "document",
    file.buffer,
    {

      filename:
        filename,

      contentType:
        fileType.contentType

    }
  );


  /* ==================================================
     IDEMPOTENCY KEY
     
     Unique per API order.
  ================================================== */

  const idempotencyKey =
    `api-order-${orderId.toString()}`;


  console.log(
    "🔑 [API FC] Idempotency-Key:",
    idempotencyKey
  );

  console.log(
    "👤 [API FC] Student:",
    studentName
  );

  console.log(
    "🔖 [API FC] Reference:",
    reference
  );

  console.log(
    "📄 [API FC] Filename:",
    filename
  );

  console.log(
    "📤 [API FC] Uploading to Faculty Checker..."
  );


  /* ==================================================
     SUBMIT TO FACULTY CHECKER
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
     LOG FACULTY CHECKER RESPONSE
  ================================================== */

  console.log(
    "\n========================================"
  );

  console.log(
    "📥 [API FC] SUBMISSION RESPONSE"
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
     HANDLE FACULTY CHECKER ERROR
  ================================================== */

  if (
    response.status < 200 ||
    response.status >= 300
  ) {

    throw new Error(
      response.data?.error?.message ||
      `Faculty Checker submission failed (${response.status})`
    );

  }


  /* ==================================================
     GET FACULTY CHECKER SUBMISSION ID
  ================================================== */

  const submissionId =
    response.data?.data?.id;


  if (!submissionId) {

    throw new Error(
      "Faculty Checker did not return a submission ID."
    );

  }


  console.log(
    "🆔 [API FC] Faculty Checker Submission:",
    submissionId
  );


  /* ==================================================
     UPDATE API ORDER
  ================================================== */

  const updatedOrder =
    await ApiOrder.findByIdAndUpdate(

      orderId,

      {

        historyId:
          submissionId,

        filename:
          filename,

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
    "✅ [API FC] SUBMISSION SUCCESSFUL"
  );

  console.log(
    "🆔 API Order:",
    orderId.toString()
  );

  console.log(
    "🆔 Faculty Checker Submission:",
    submissionId
  );

  console.log(
    "📄 Filename:",
    filename
  );

  console.log(
    "📊 Status:",
    updatedOrder?.status
  );

  console.log(
    "⚙️ Processing:",
    updatedOrder?.processing
  );

  console.log(
    "========================================"
  );


  console.log(
    "\n⏳ [API FC] WAITING FOR FACULTY CHECKER WEBHOOK..."
  );

  console.log(
    "📡 Webhook will update ApiOrder:",
    orderId.toString()
  );


  return {

    submissionId,

    orderId:

      orderId.toString(),

    status:
      "processing"

  };

}


/* ======================================================
   EXPORT
====================================================== */

export default {
  processApiDocument
};
