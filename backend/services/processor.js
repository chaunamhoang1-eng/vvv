
import axios from "axios";
import crypto from "crypto";
import Order from "../models/Order.js";

/* ================= CONFIG ================= */

const TT_BASE_URL = "https://api.turnitin.live/api/v1/agent";
const TT_API_KEY = process.env.TT_API_KEY;
const TT_API_SECRET = process.env.TT_API_SECRET;
const CALLBACK_URL = process.env.TT_CALLBACK_URL;

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
      timeout: 30_000
    }
  );

  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || "Turnitin submit failed");
  }

  return res.data;
}

/* ================= MAIN PROCESS ================= */

export async function processDocument(orderId, fileURL) {
  console.log("⚙️ TURNITIN SUBMIT:", orderId);

  const order = await Order.findById(orderId);
  if (!order) return;

  // prevent duplicate submits
  if (
    order.processing ||
    order.status === "completed" ||
    order.status === "failed"
  ) return;

  const payload = {
    file_url: fileURL,
    external_order_id: orderId,
    callback_url: CALLBACK_URL
  };

  const submit = await signedPost("/check/submit", payload);

  await Order.findByIdAndUpdate(orderId, {
    historyId: submit.data.history_id,
    status: "processing",
    processing: true
  });

  console.log("✅ TURNITIN SUBMITTED:", submit.data.history_id);
}
