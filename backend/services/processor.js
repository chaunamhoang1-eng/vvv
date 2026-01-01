import axios from "axios";
import crypto from "crypto";
import Order from "../models/Order.js";

/* ================= CONFIG ================= */
const API_KEY = "ak_c3efb0510572b49d46bb4cf24c85a1cb";
const API_SECRET = "c97d9fbf203caa87fda08655f716d97aa3dcf6e0596b144e6a6fbf00a980210e";
const BASE_URL = "https://api.turnitin.live/api/v1/agent";

const POLL_INTERVAL = 10000; // 10 seconds
const MAX_TRIES = 24;        // ~4 minutes

/* ================= SIGNATURE ================= */
function createSignature(timestamp, nonce, body = "") {
  return crypto
    .createHmac("sha256", API_SECRET)
    .update(timestamp + nonce + body)
    .digest("hex");
}

/* ================= SIGNED POST ================= */
async function signedPost(endpoint, payload) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(8).toString("hex");
  const body = JSON.stringify(payload);

  const signature = createSignature(timestamp, nonce, body);

  const res = await axios.post(`${BASE_URL}${endpoint}`, body, {
    headers: {
      "X-Api-Key": API_KEY,
      "X-Timestamp": timestamp,
      "X-Nonce": nonce,
      "X-Signature": signature,
      "Content-Type": "application/json"
    },
    timeout: 30000
  });

  return res.data;
}

/* ================= MAIN PROCESS ================= */
export async function processDocument(orderId, fileURL) {
  try {
    console.log("⚙️ AUTO CHECK START:", orderId);

    /* ===== SUBMIT FILE ===== */
    const submitRes = await signedPost("/check/submit", {
      file_url: fileURL
    });

    console.log("📨 Submit response:", submitRes);

    if (!submitRes.success) {
      console.error("❌ Submit failed");
      return;
    }

    const historyId = submitRes.data.history_id;
    console.log("🆔 history_id saved:", historyId);

    /* ===== POLLING LOOP ===== */
    let tries = 0;

    while (tries < MAX_TRIES) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      tries++;

      const resultRes = await signedPost("/check/result", {
        history_id: historyId
      });

      const status = resultRes?.data?.status;
      console.log("🔄 Poll status:", status);

      /* ===== COMPLETED ===== */
      if (status === "completed") {
        const result = resultRes.data.result;

        await Order.findByIdAndUpdate(orderId, {
          aiReport: {
            filename: "AI Report",
            storedName: result.ai_report_url,
            percentage: Number(result.ai_index) || 0
          },
          plagReport: {
            filename: "Plagiarism Report",
            storedName: result.similarity_report_url,
            percentage: Number(result.similarity_index) || 0
          },
          status: "completed"
        });

        console.log("✅ RESULT SAVED:", orderId);
        return;
      }

      /* ===== API ERROR ===== */
      if (status === "error") {
        console.error("❌ API ERROR:", resultRes);
        return;
      }
    }

    /* ===== TIMEOUT ===== */
    console.error("⏱️ API TIMEOUT:", orderId);

  } catch (err) {
    console.error("❌ PROCESS FAILED:", err.message);
  }
}
