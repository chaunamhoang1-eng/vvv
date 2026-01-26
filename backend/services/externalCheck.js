// backend/services/externalCheck.js
import axios from "axios";
import crypto from "crypto";
import ApiOrder from "../models/ApiOrder.js";
import ApiUser from "../models/ApiUser.js";

/* ================= CONFIG ================= */
const BASE_URL = "https://origincheckai.com/api/v1/agent";
const API_KEY = process.env.OC_API_KEY;
const API_SECRET = process.env.OC_API_SECRET;

const POLL_INTERVAL = 5000;     // 5 seconds
const MAX_POLLS = 120;          // 10 minutes

/* ================= SIGNATURE ================= */
function createSignature(timestamp, nonce, body = "") {
  return crypto
    .createHmac("sha256", API_SECRET)
    .update(timestamp + nonce + body)
    .digest("hex");
}

/* ================= SIGNED REQUEST ================= */
async function signedRequest(endpoint, method = "GET", payload = null) {
  const url = BASE_URL + endpoint;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(8).toString("hex");
  const body = payload ? JSON.stringify(payload) : "";

  const signature = createSignature(timestamp, nonce, body);

  const headers = {
    "X-Api-Key": API_KEY,
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "X-Signature": signature,
    "Content-Type": "application/json"
  };

  const res = await axios({
    url,
    method,
    headers,
    data: body,
    timeout: 30000,
    validateStatus: () => true
  });

  console.log("🔎 ORIGINCHECK RESPONSE:", res.data);

  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || "OriginCheck request failed");
  }

  return res.data;
}

/* ================= SUBMIT DOCUMENT ================= */
async function submitDocument(fileUrl, orderId) {
  const payload = {
    file_url: fileUrl,
    external_order_id: String(orderId)
    // ❌ No callback_url because you want polling only
  };

  const res = await signedRequest("/check/submit", "POST", payload);
  return res.data.history_id;
}

/* ================= GET RESULT ================= */
async function getResult(historyId) {
  const res = await signedRequest(`/check/result?history_id=${historyId}`, "GET");
  return res.data;
}

/* ================= MAIN POLLING PROCESS ================= */
export async function processOriginCheck(orderId, fileURL) {
  console.log("⚙️ OriginCheck → Submitting:", orderId);

  const order = await ApiOrder.findById(orderId);
  if (!order) return;

  // SUBMIT
  const historyId = await submitDocument(fileURL, orderId);

  await ApiOrder.findByIdAndUpdate(orderId, {
    historyId,
    status: "processing",
    processing: true
  });

  console.log("⏳ Polling Started:", historyId);

  // POLLING LOOP
  for (let i = 1; i <= MAX_POLLS; i++) {
    console.log(`🔁 Poll ${i}: checking...`);

    let result;

    try {
      result = await getResult(historyId);
    } catch (err) {
      console.log("⚠️ Temporary error, retrying...");
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      continue;
    }

    const status = result.status;

    console.log(`📡 Status: ${status}`);

    if (status === "completed") {
      const r = result.result;

      const aiData = {
        percentage: r.ai_index,
        storedName: r.ai_report_url
      };

      const simData = {
        percentage: r.similarity_index,
        storedName: r.similarity_report_url
      };

      await ApiOrder.findByIdAndUpdate(orderId, {
        status: "completed",
        processing: false,
        completedAt: new Date(),
        aiReport: aiData,
        plagReport: simData,
        creditDeducted: true
      });

      await ApiUser.updateOne(
        { apiKey: order.apiKey },
        {
          $inc: { credits: -1, totalUsed: 1 },
          $set: { lastUsedAt: new Date() }
        }
      );

      console.log("✅ Completed:", orderId);
      return;
    }

    if (status === "failed" || status === "timeout") {
      await ApiOrder.findByIdAndUpdate(orderId, {
        status,
        processing: false
      });
      console.log("❌ Failed:", status);
      return;
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }

  // TIMEOUT
  await ApiOrder.findByIdAndUpdate(orderId, {
    status: "timeout",
    processing: false
  });

  console.log("⏰ Polling Timeout:", orderId);
}
