// backend/services/externalCheck.js
import axios from "axios";
import crypto from "crypto";
import Order from "../models/Order.js";
import User from "../models/user.js";

/* ================= CONFIG ================= */

const OC_BASE_URL = "https://origincheckai.com/api/v1/agent";
const OC_API_KEY = process.env.OC_API_KEY;
const OC_API_SECRET = process.env.OC_API_SECRET;

const POLL_INTERVAL = 5000; // 5 seconds
const MAX_TRIES = 120;      // 10 minutes

/* ================= SIGNATURE ================= */

function createSignature(timestamp, nonce, body = "") {
  const data = `${timestamp}${nonce}${body}`;

  return crypto
    .createHmac("sha256", OC_API_SECRET)
    .update(data)
    .digest("hex");
}

/* ================= SIGNED REQUEST ================= */

async function signedRequest(endpoint, method = "GET", payload = null) {
  const url = `${OC_BASE_URL}${endpoint}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const body = payload ? JSON.stringify(payload) : "";

  const signature = createSignature(timestamp, nonce, body);

  const headers = {
    "X-Api-Key": OC_API_KEY,
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

  console.log("📡 ORIGIN CHECK API RESPONSE:", res.data);

  if (!res.data || res.data.success !== true) {
    throw new Error(
      res.data?.error?.message || `OriginCheck API failed (HTTP ${res.status})`
    );
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

/* ================= POLL RESULT ================= */

async function fetchResult(historyId) {
  const res = await signedRequest(`/check/result?history_id=${historyId}`, "GET");
  return res.data;
}

/* ================= MAIN PROCESS ================= */

export async function processOriginCheck(orderId, fileURL) {
  console.log("⚙️ OriginCheck → Starting:", orderId);

  const order = await Order.findById(orderId);
  if (!order) return;

  if (["completed", "failed"].includes(order.status)) return;

  // ----- SUBMIT -----
  const historyId = await submitDocument(fileURL, orderId);

  await Order.findByIdAndUpdate(orderId, {
    historyId,
    status: "processing",
    processing: true
  });

  console.log("⏳ POLLING START:", historyId);

  // ----- POLLING LOOP -----
  for (let i = 1; i <= MAX_TRIES; i++) {
    console.log(`🔁 Poll ${i}/${MAX_TRIES}`);

    let result;

    try {
      result = await fetchResult(historyId);
    } catch (err) {
      console.log("⚠️ TEMP ERROR:", err.message);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      continue;
    }

    const status = result.status;

    if (status === "completed") {
      console.log("📄 REPORT READY:", result);

      await Order.findByIdAndUpdate(orderId, {
        status: "completed",
        processing: false,
        completedAt: new Date(),

        aiReport: {
          filename: "AI Report",
          storedName: result.ai_report_url,
          percentage: result.ai_index
        },

        plagReport: {
          filename: "Similarity Report",
          storedName: result.similarity_report_url,
          percentage: result.similarity_index
        },

        creditDeducted: true
      });

      await User.updateOne(
        { email: order.email },
        {
          $inc: { credits: -1, totalUsed: 1 },
          $set: { lastUsedAt: new Date() }
        }
      );

      return;
    }

    if (status === "failed" || status === "timeout") {
      await Order.findByIdAndUpdate(orderId, {
        status,
        processing: false
      });

      console.error("❌ FAILED:", status);
      return;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  // ----- TIMEOUT -----

  await Order.findByIdAndUpdate(orderId, {
    status: "timeout",
    processing: false
  });

  console.error("⏰ ORIGIN CHECK TIMEOUT");
}
