// backend/services/processor.js
import axios from "axios";
import crypto from "crypto";
import Order from "../models/Order.js";
import User from "../models/user.js";

/* ================= CONFIG ================= */
const OC_BASE_URL = "https://origincheckai.com/api/v1/agent";
const OC_API_KEY = process.env.TT_API_KEY;
const OC_API_SECRET = process.env.TT_API_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL + "/normal-user/origincheck";

/* ================= SIGNATURE ================= */
function createSignature(timestamp, nonce, body = "") {
  return crypto
    .createHmac("sha256", OC_API_SECRET)
    .update(timestamp + nonce + body)
    .digest("hex");
}

/* ================= SIGNED POST ================= */
async function signedPost(endpoint, payload) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(8).toString("hex");
  const body = JSON.stringify(payload);

  const signature = createSignature(timestamp, nonce, body);

  const res = await axios.post(
    `${OC_BASE_URL}${endpoint}`,
    body,
    {
      headers: {
        "X-Api-Key": OC_API_KEY,
        "X-Timestamp": timestamp,
        "X-Nonce": nonce,
        "X-Signature": signature,
        "Content-Type": "application/json"
      },
      timeout: 30000,
      validateStatus: () => true
    }
  );

  if (!res.data?.success) {
    throw new Error(
      res.data?.error?.message || "OriginCheck submit failed"
    );
  }

  return res.data;
}

/* =====================================================
   🚀 MAIN PROCESS — SUBMIT ONLY (CALLBACK HANDLES RESULT)
===================================================== */
export async function processDocument(orderId, fileURL) {
  console.log("📤 Submitting document to OriginCheck:", orderId);

  const order = await Order.findById(orderId);
  if (!order) return;

  // PAYLOAD EXACTLY AS DOCUMENTATION
  const payload = {
    file_url: fileURL,
    external_order_id: String(orderId),
    callback_url: CALLBACK_URL,
    options: {
      exclude_bibliography: true,
      exclude_quotes: false
    }
  };

  // API REQUEST
  const response = await signedPost("/check/submit", payload);

  // Extract documentation fields
  const {
    request_id,
    history_id,
    oid_id,
    external_order_id,
    status,
    quota_used,
    remaining_quota
  } = response.data;

  // Save initial state
  await Order.findByIdAndUpdate(orderId, {
    requestId: request_id,
    historyId: history_id,
    oidId: oid_id,
    externalOrderId: external_order_id,
    status: status, // "pending"
    processing: true,
    submittedAt: new Date()
  });

  console.log("⏳ Awaiting callback from OriginCheck...");
}
