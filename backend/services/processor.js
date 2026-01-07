import axios from "axios";
import crypto from "crypto";
import Order from "../models/Order.js";
import User from "../models/user.js";

/* ================= CONFIG ================= */

const TT_API_KEY = process.env.TT_API_KEY;
const TT_API_SECRET = process.env.TT_API_SECRET;
const TT_BASE_URL = "https://api.turnitin.live/api/v1/agent";

const POLL_INTERVAL = 10_000; // 10 sec
const MAX_TRIES = 24;        // ~4 min

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

  const res = await axios.post(`${TT_BASE_URL}${endpoint}`, body, {
    headers: {
      "X-Api-Key": TT_API_KEY,
      "X-Timestamp": timestamp,
      "X-Nonce": nonce,
      "X-Signature": signature,
      "Content-Type": "application/json"
    },
    timeout: 30_000
  });

  return res.data;
}

/* ================= PROCESS DOCUMENT ================= */

export async function processDocument(orderId, fileURL) {
  console.log("⚙️ SIGNED TT PROCESS START:", orderId);

  try {
    const order = await Order.findById(orderId);
    if (!order) return;

    /* ===== HARD EXIT ===== */
    if (
      order.status === "completed" ||
      order.status === "partial" ||
      order.status === "failed" ||
      order.creditDeducted
    ) return;

    /* ===== SUBMIT FILE ===== */
    const submit = await signedPost("/check/submit", {
      file_url: fileURL
    });

    if (!submit.success) {
      throw new Error("Turnitin submit failed");
    }

    const historyId = submit.data.history_id;
    console.log("🆔 history_id:", historyId);

    /* ===== POLLING ===== */
    let resultData = null;

    for (let i = 0; i < MAX_TRIES; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));

      const res = await signedPost("/check/result", {
        history_id: historyId
      });

      const status = res?.data?.status;
      console.log("🔄 Poll status:", status);

      if (status === "completed") {
        resultData = res.data.result;
        break;
      }

      if (status === "error") {
        throw new Error("Turnitin processing error");
      }
    }

    if (!resultData) {
      console.log("⏳ Still processing:", orderId);
      return; // DO NOT fail, DO NOT deduct
    }

    /* ===== RESULT ===== */
    const aiOk = Boolean(resultData.ai_report_url);
    const plagOk = Boolean(resultData.similarity_report_url);
    const status = aiOk && plagOk ? "completed" : "partial";

    await Order.findByIdAndUpdate(orderId, {
      aiReport: aiOk
        ? {
            filename: "AI Report",
            storedName: resultData.ai_report_url,
            percentage: Number(resultData.ai_index) || 0
          }
        : undefined,

      plagReport: plagOk
        ? {
            filename: "Plagiarism Report",
            storedName: resultData.similarity_report_url,
            percentage: Number(resultData.similarity_index) || 0
          }
        : undefined,

      status,
      completedAt: new Date()
    });

    /* ===== CREDIT DEDUCTION (ONCE) ===== */
    const fresh = await Order.findById(orderId);

    if (!fresh.creditDeducted) {
      await User.updateOne(
        { email: fresh.email },
        {
          $inc: { credits: -1, totalUsed: 1 },
          $set: { lastUsedAt: new Date() }
        }
      );

      await Order.findByIdAndUpdate(orderId, {
        creditDeducted: true
      });

      console.log("💳 Credit deducted:", orderId);
    }

    console.log(`✅ ORDER ${status.toUpperCase()}:`, orderId);

  } catch (err) {
    console.error("❌ SIGNED TT ERROR:", err.message);

    const latest = await Order.findById(orderId);
    if (latest && latest.retryCount >= 1) {
      await Order.findByIdAndUpdate(orderId, { status: "failed" });
      return;
    }

    await Order.findByIdAndUpdate(orderId, {
      $inc: { retryCount: 1 }
    });

  } finally {
    await Order.findByIdAndUpdate(orderId, {
      processing: false
    });
  }
}
