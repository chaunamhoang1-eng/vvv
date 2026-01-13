import axios from "axios";
import crypto from "crypto";
import Order from "../models/Order.js";
import User from "../models/user.js";

/* ================= CONFIG ================= */

const TT_BASE_URL = "https://api.turnitin.live/api/v1/agent";
const TT_API_KEY = process.env.TT_API_KEY;
const TT_API_SECRET = process.env.TT_API_SECRET;

const POLL_INTERVAL = 30_000; // 30 seconds
const MAX_TRIES = 20;         // ~10 minutes

/* ================= SIGNATURE ================= */

function createSignature(timestamp, nonce, body = "") {
  return crypto
    .createHmac("sha256", TT_API_SECRET)
    .update(timestamp + nonce + body)
    .digest("hex");
}

async function signedPost(endpoint, payload) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(8).toString("hex");
  const body = JSON.stringify(payload);

  const signature = createSignature(timestamp, nonce, body);

  const res = await axios.post(
    `${TT_BASE_URL}${endpoint}`,
    body,
    {
      headers: {
        "X-Api-Key": TT_API_KEY,
        "X-Timestamp": timestamp,
        "X-Nonce": nonce,
        "X-Signature": signature,
        "Content-Type": "application/json"
      },
      timeout: 30_000,
      validateStatus: () => true // ✅ DO NOT THROW ON 500
    }
  );

  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || "Turnitin submit failed");
  }

  return res.data;
}

/* ================= SAFE RESULT FETCH ================= */

async function getResult(historyId) {
  try {
    const res = await axios.get(
      `${TT_BASE_URL}/check/result`,
      {
        params: { history_id: historyId },
        headers: {
          "X-Api-Key": TT_API_KEY
        },
        timeout: 30_000,
        validateStatus: () => true // ✅ VERY IMPORTANT
      }
    );

    return res.data;
  } catch (err) {
    console.error("⚠️ TURNITIN POLL REQUEST ERROR:", err.message);
    return null; // ✅ swallow error and retry
  }
}

/* ================= MAIN PROCESS ================= */

export async function processDocument(orderId, fileURL) {
  console.log("⚙️ TURNITIN SUBMIT:", orderId);

  const order = await Order.findById(orderId);
  if (!order) return;

  // ✅ DO NOT BLOCK ON processing (queue already handles this)
  if (
    order.status === "completed" ||
    order.status === "failed"
  ) return;

  /* ===== SUBMIT ===== */
  const submit = await signedPost("/check/submit", {
    file_url: fileURL,
    external_order_id: orderId
  });

  const historyId = submit.data.history_id;

  await Order.findByIdAndUpdate(orderId, {
    historyId,
    status: "processing",
    processing: true
  });

  console.log("⏳ POLLING START:", historyId);

  /* ===== INITIAL WAIT ===== */
  await new Promise(r => setTimeout(r, POLL_INTERVAL));

  /* ===== POLLING LOOP ===== */
  for (let i = 1; i <= MAX_TRIES; i++) {
    console.log(`🔁 POLL ${i}/${MAX_TRIES}:`, historyId);

    const res = await getResult(historyId);

    // 🔁 TEMP ERROR / 500 / NETWORK ISSUE
    if (!res || !res.success) {
      console.warn("⚠️ TEMP TURNITIN ERROR, RETRYING...");
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      continue;
    }

    const status = res.data.status;

    if (status === "completed") {
      const result = res.data.result;

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
          filename: "Plagiarism Report",
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

      console.log("✅ TURNITIN COMPLETED:", orderId);
      return;
    }

    if (status === "failed" || status === "timeout") {
      await Order.findByIdAndUpdate(orderId, {
        status,
        processing: false
      });

      console.error("❌ TURNITIN FAILED:", status);
      return;
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }

  /* ===== POLL TIMEOUT ===== */
  await Order.findByIdAndUpdate(orderId, {
    status: "timeout",
    processing: false
  });

  console.error("⏰ TURNITIN POLL TIMEOUT:", orderId);
}
