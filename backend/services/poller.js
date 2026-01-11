import Order from "../models/Order.js";
import ApiUser from "../models/ApiUser.js";
import axios from "axios";
import crypto from "crypto";

const TT_API_KEY = process.env.TT_API_KEY;
const TT_API_SECRET = process.env.TT_API_SECRET;
const TT_BASE_URL = "https://api.turnitin.live/api/v1/agent";

function createSignature(timestamp, nonce, body = "") {
  return crypto
    .createHmac("sha256", TT_API_SECRET)
    .update(timestamp + nonce + body)
    .digest("hex");
}

async function signedPost(endpoint, payload) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");
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
      }
    }
  );

  return res.data;
}

export async function pollOrders() {
  const orders = await Order.find({
    status: "processing",
    provider: "SIGNED_TT"
  }).limit(5);

  for (const order of orders) {
    const res = await signedPost("/check/result", {
      history_id: order.providerRef
    });

    if (res?.data?.status !== "completed") continue;

    const r = res.data.result;

    await Order.findByIdAndUpdate(order._id, {
      aiReport: r.ai_report_url
        ? { filename: "AI", storedName: r.ai_report_url, percentage: r.ai_index }
        : undefined,
      plagReport: r.similarity_report_url
        ? { filename: "Plagiarism", storedName: r.similarity_report_url, percentage: r.similarity_index }
        : undefined,
      status: "completed",
      completedAt: new Date(),
      processing: false
    });

    await ApiUser.updateOne(
      { _id: order.apiUserId },
      {
        $inc: { credits: -1, totalUsed: 1 },
        $set: { lastUsedAt: new Date() }
      }
    );
  }
}
