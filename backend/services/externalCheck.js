import axios from "axios";
import crypto from "crypto";
import ApiOrder from "../models/ApiOrder.js";
import ApiUser from "../models/ApiUser.js";

/* ================= CONFIG ================= */
const OC_BASE_URL = "https://origincheckai.com/api/v1/agent";
const OC_API_KEY = process.env.OC_API_KEY;
const OC_API_SECRET = process.env.OC_API_SECRET;

const POLL_INTERVAL = 5000; // 5 seconds
const MAX_TRIES = 120; // 10 minutes

/* ================= SIGNATURE ================= */
function createSignature(timestamp, nonce, body = "") {
  const data = `${timestamp}${nonce}${body}`;
  return crypto.createHmac("sha256", OC_API_SECRET).update(data).digest("hex");
}

/* ================= MAKE SIGNED REQUEST ================= */
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
    const msg = res.data?.error?.message || `OriginCheck failed (HTTP ${res.status})`;
    throw new Error(msg);
  }

  return res.data;
}

/* ================= SUBMIT FILE ================= */
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

/* ================= MAIN POLLING PROCESS ================= */

export async function processOriginCheck(orderId, fileURL) {
  console.log("⚙️ OriginCheck Polling Started:", orderId);

  const order = await ApiOrder.findById(orderId);
  if (!order) return;
  if (["completed", "failed"].includes(order.status)) return;

  /* ---------- 1. SUBMIT DOCUMENT ---------- */
  const historyId = await submitDocument(fileURL, orderId);

  await ApiOrder.findByIdAndUpdate(orderId, {
    historyId,
    status: "processing",
    processing: true
  });

  console.log("⏳ Polling Started:", historyId);

  /* ---------- 2. POLLING LOOP ---------- */
  for (let i = 1; i <= MAX_TRIES; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));

    let res;
    try {
      res = await fetchResult(historyId);
    } catch (err) {
      console.log("⚠️ Poll error, retrying...", err.message);
      continue;
    }

    const status = res.status;

    console.log(`🔁 Poll ${i}: ${status}`);

    /* ---------- COMPLETED ---------- */
    if (status === "completed") {
      const r = res.result || {};

      const aiData = {
        filename: "AI Report",
        storedName: r.ai_report_url || null,
        percentage: r.ai_index ?? null
      };

      const plagData = {
        filename: "Similarity Report",
        storedName: r.similarity_report_url || null,
        percentage: r.similarity_index ?? null
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

      console.log("✅ Completed:", orderId);
      return;
    }

    /* ---------- FAILED / TIMEOUT ---------- */
    if (status === "failed" || status === "timeout") {
      await ApiOrder.findByIdAndUpdate(orderId, {
        status,
        processing: false
      });

      console.log("❌ ERROR:", status);
      return;
    }
  }

  /* ---------- 3. POLLING TIMEOUT ---------- */
  await ApiOrder.findByIdAndUpdate(orderId, {
    status: "timeout",
    processing: false
  });

  console.log("⏰ POLLING TIMEOUT:", orderId);
}
