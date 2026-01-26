// services/externalCheck.js
import axios from "axios";
import crypto from "crypto";
import ApiOrder from "../models/ApiOrder.js";
import ApiUser from "../models/ApiUser.js";

/* ================= CONFIG ================= */
const OC_BASE_URL = "https://origincheckai.com/api/v1/agent";
const OC_API_KEY = process.env.OC_API_KEY;
const OC_API_SECRET = process.env.OC_API_SECRET;

const POLL_INTERVAL = 5000;
const MAX_TRIES = 120;

/* ================= SIGNATURE ================= */
function createSignature(timestamp, nonce, body = "") {
  return crypto
    .createHmac("sha256", OC_API_SECRET)
    .update(`${timestamp}${nonce}${body}`)
    .digest("hex");
}

/* ================= API REQUEST ================= */
async function signedRequest(endpoint, method = "GET", payload = null) {
  const url = `${OC_BASE_URL}${endpoint}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");

  const body = payload ? JSON.stringify(payload) : "";
  const signature = createSignature(timestamp, nonce, body);

  const res = await axios({
    url,
    method,
    data: body,
    headers: {
      "X-Api-Key": OC_API_KEY,
      "X-Timestamp": timestamp,
      "X-Nonce": nonce,
      "X-Signature": signature,
      "Content-Type": "application/json"
    },
    timeout: 30000,
    validateStatus: () => true
  });

  if (!res.data || res.data.success !== true) {
    throw new Error(res.data?.error?.message || "OriginCheck API failed");
  }

  return res.data;
}

/* ================= SUBMIT ================= */
async function submitDocument(fileURL, orderId) {
  const payload = {
    file_url: fileURL,
    external_order_id: String(orderId)
  };

  const res = await signedRequest("/check/submit", "POST", payload);
  return res.data.history_id;
}

/* ================= GET RESULT ================= */
async function fetchResult(historyId) {
  const res = await signedRequest(`/check/result?history_id=${historyId}`, "GET");
  return res.data;
}

/* ================= CALLBACK ================= */
async function sendCallback(url, data) {
  try {
    await axios.post(url, data, { timeout: 20000 });
    console.log("📨 Callback sent:", url);
  } catch (err) {
    console.error("❌ Callback failed:", err.message);
  }
}

/* ================= PROCESS DOCUMENT ================= */
export async function processOriginCheck(orderId, fileURL) {
  const order = await ApiOrder.findById(orderId);
  if (!order) return;

  if (["completed", "failed"].includes(order.status)) return;

  // SUBMIT
  const historyId = await submitDocument(fileURL, orderId);

  await ApiOrder.findByIdAndUpdate(orderId, {
    historyId,
    status: "processing",
    processing: true
  });

  // POLLING
  for (let i = 1; i <= MAX_TRIES; i++) {
    let result;

    try {
      result = await fetchResult(historyId);
    } catch {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      continue;
    }

    const status = result.status;

    if (status === "completed") {
      const aiData = {
        filename: "AI Report",
        storedName: result.ai_report_url,
        percentage: result.ai_index
      };

      const plagData = {
        filename: "Similarity Report",
        storedName: result.similarity_report_url,
        percentage: result.similarity_index
      };

      await ApiOrder.findByIdAndUpdate(orderId, {
        status: "completed",
        processing: false,
        completedAt: new Date(),
        aiReport: aiData,
        plagReport: plagData,
        creditDeducted: true
      });

      await ApiUser.updateOne(
        { apiKey: order.apiKey },
        {
          $inc: { credits: -1, totalUsed: 1 },
          $set: { lastUsedAt: new Date() }
        }
      );

      if (order.callbackURL) {
        await sendCallback(order.callbackURL, {
          success: true,
          order_id: orderId,
          ai_report: aiData,
          similarity_report: plagData
        });
      }

      return;
    }

    if (status === "failed" || status === "timeout") {
      await ApiOrder.findByIdAndUpdate(orderId, { status, processing: false });
      return;
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }

  await ApiOrder.findByIdAndUpdate(orderId, {
    status: "timeout",
    processing: false
  });
}
