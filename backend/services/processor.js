import axios from "axios";
import crypto from "crypto";
import Order from "../models/Order.js";
import User from "../models/user.js";

/* ================= CONFIG ================= */

const PLAGX_API_URL = "https://vvv-ch7d.onrender.com/api/plag/check";
const PLAGX_API_KEY = process.env.PLAGX_API_KEY;

const TT_API_KEY = process.env.TT_API_KEY;
const TT_API_SECRET = process.env.TT_API_SECRET;
const TT_BASE_URL = "https://api.turnitin.live/api/v1/agent";

const TD_API_URL = "https://td-turnitin.vercel.app";
const TD_API_KEY = process.env.TD_API_KEY;

const POLL_INTERVAL = 10_000;
const MAX_TRIES = 24;

/* ================= SIGNED TT ================= */

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

  const res = await axios({
    method: "POST",
    url: `${TT_BASE_URL}${endpoint}`,
    headers: {
      "X-Api-Key": TT_API_KEY,
      "X-Timestamp": timestamp,
      "X-Nonce": nonce,
      "X-Signature": signature,
      "Content-Type": "application/json"
    },
    data: body,
    timeout: 30_000,
    validateStatus: () => true
  });

  if (res.status === 401) {
    throw new Error("Signed TT authentication failed");
  }

  return res.data;
}

/* ================= NORMALIZATION ================= */

function normalizePlagX(raw) {
  return {
    ai_percentage: Number(raw.ai_score) || 0,
    similarity_percentage: Number(raw.similarity_score) || 0,
    ai_report_url: raw.outputs?.ai_url || null,
    similarity_report_url: raw.outputs?.similarity_url || null
  };
}

function normalizeSignedTT(raw) {
  const r = raw?.data?.result || {};
  return {
    ai_percentage: Number(r.ai_index) || 0,
    similarity_percentage: Number(r.similarity_index) || 0,
    ai_report_url: r.ai_report_url || null,
    similarity_report_url: r.similarity_report_url || null
  };
}

function normalizeTdTT(raw) {
  return {
    ai_percentage: raw.ai_index
      ? parseInt(raw.ai_index.replace("%", ""), 10)
      : 0,
    similarity_percentage: raw.similarity_index
      ? parseInt(raw.similarity_index.replace("%", ""), 10)
      : 0,
    ai_report_url: raw.ai_report_url || null,
    similarity_report_url: raw.similarity_report_url || null
  };
}

/* ================= PROVIDERS ================= */

async function runPlagX(fileURL) {
  const res = await axios.post(
    PLAGX_API_URL,
    { file_url: fileURL },
    {
      headers: {
        "X-API-Key": PLAGX_API_KEY,
        "Content-Type": "application/json"
      },
      timeout: 35 * 60 * 1000
    }
  );

  if (!res.data?.success) {
    throw new Error("PlagX rejected request");
  }

  const normalized = normalizePlagX(res.data);

  if (!normalized.ai_report_url && !normalized.similarity_report_url) {
    throw new Error("PlagX still processing");
  }

  return normalized;
}

async function runSignedTurnitin(fileURL) {
  const submit = await signedPost("/check/submit", { file_url: fileURL });
  if (!submit?.success) throw new Error("Signed TT submit failed");

  const historyId = submit.data.history_id;

  for (let i = 0; i < MAX_TRIES; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
    const res = await signedPost("/check/result", { history_id: historyId });

    if (res?.data?.status === "completed") {
      return normalizeSignedTT(res);
    }

    if (res?.data?.status === "error") {
      throw new Error("Signed TT error");
    }
  }

  throw new Error("Signed TT timeout");
}

async function runTdTurnitin(fileURL) {
  let submissionId;

  const submit = await axios.post(
    `${TD_API_URL}/submit`,
    new URLSearchParams({ url: fileURL }),
    {
      headers: {
        "X-Auth-Code": TD_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  submissionId = submit.data?.submission_id;
  if (!submissionId) throw new Error("TD submit failed");

  for (let i = 0; i < MAX_TRIES; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
    const res = await axios.get(`${TD_API_URL}/receive/${submissionId}`, {
      headers: { "X-Auth-Code": TD_API_KEY }
    });

    if (res.data?.status === "done") return normalizeTdTT(res.data);
    if (res.data?.status === "error") throw new Error("TD error");
  }

  throw new Error("TD timeout");
}

/* ================= ROTATION ================= */

async function runWithRotation(fileURL) {
  const providers = [runPlagX, runSignedTurnitin, runTdTurnitin];

  for (const fn of providers) {
    try {
      return await fn(fileURL);
    } catch {}
  }

  throw new Error("All providers failed");
}

/* ================= PROCESS DOCUMENT ================= */

export async function processDocument(orderId, fileURL) {
  console.log("⚙️ PROCESS START:", orderId);

  try {
    const order = await Order.findById(orderId);
    if (!order) return;

    // ❗ ONLY BLOCK IF CREDIT ALREADY USED
    if (order.creditDeducted) {
      console.log("🔒 Credit already deducted:", orderId);
      return;
    }

    const result = await runWithRotation(fileURL);

    const aiOk = Boolean(result.ai_report_url);
    const plagOk = Boolean(result.similarity_report_url);
    const status = aiOk && plagOk ? "completed" : "partial";

    await Order.findByIdAndUpdate(orderId, {
      aiReport: aiOk
        ? { filename: "AI Report", storedName: result.ai_report_url, percentage: result.ai_percentage }
        : undefined,
      plagReport: plagOk
        ? { filename: "Plagiarism Report", storedName: result.similarity_report_url, percentage: result.similarity_percentage }
        : undefined,
      status,
      completedAt: new Date()
    });

    // ✅ ATOMIC CREDIT DEDUCTION (CANNOT FAIL SILENTLY)
    const locked = await Order.findOneAndUpdate(
      { _id: orderId, creditDeducted: false },
      { creditDeducted: true },
      { new: true }
    );

    if (locked) {
      await User.updateOne(
        { email: locked.email },
        {
          $inc: { credits: -1, totalUsed: 1 },
          $set: { lastUsedAt: new Date() }
        }
      );
      console.log("💳 CREDIT DEDUCTED:", orderId);
    }

    console.log(`✅ ORDER ${status.toUpperCase()}:`, orderId);

  } catch (err) {
    console.error("❌ PROCESS ERROR:", err.message);

    await Order.findByIdAndUpdate(orderId, {
      $inc: { retryCount: 1 }
    });

  } finally {
    await Order.findByIdAndUpdate(orderId, { processing: false });
  }
}
