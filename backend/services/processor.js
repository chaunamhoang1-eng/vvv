import axios from "axios";
import Order from "../models/Order.js";
import User from "../models/user.js";

/* ================= CONFIG ================= */
const PLAGX_API_URL = "https://vvv-ch7d.onrender.com/api/plag/check";
const PLAGX_API_KEY = process.env.PLAGX_API_KEY;

/* ================= PROCESS DOCUMENT ================= */
/**
 * RULES:
 * - Max 2 attempts (1 retry)
 * - Credit deducted ONLY if AI or Plag report generated
 * - Never double deduct
 * - Failed orders permanently leave queue
 */
export async function processDocument(orderId, fileURL) {
  console.log("⚙️ PLAGX PROCESS START:", orderId);

  const order = await Order.findById(orderId);
  if (!order) return;

  /* ================= HARD EXIT ================= */
  if (
    order.status === "completed" ||
    order.status === "partial" ||
    order.status === "failed" ||
    order.creditDeducted
  ) {
    await Order.findByIdAndUpdate(orderId, { processing: false });
    return;
  }

  try {
    /* ================= ATTEMPT COUNT ================= */
    await Order.findByIdAndUpdate(orderId, {
      $inc: { retryCount: 1 }
    });

    /* ================= CALL PLAGX API ================= */
    const res = await axios.post(
      PLAGX_API_URL,
      { file_url: fileURL },
      {
        headers: {
          "X-API-Key": PLAGX_API_KEY,
          "Content-Type": "application/json"
        },
        timeout: 30 * 60 * 1000
      }
    );

    const data = res.data;

    if (!data || data.success !== true) {
      throw new Error("PlagX rejected request");
    }

    const aiUrl = data.outputs?.ai_url || null;
    const simUrl = data.outputs?.similarity_url || null;

    const aiOk = Boolean(aiUrl);
    const plagOk = Boolean(simUrl);

    if (!aiOk && !plagOk) {
      throw new Error("No reports generated");
    }

    /* ================= STATUS ================= */
    const status =
      aiOk && plagOk ? "completed" : "partial";

    /* ================= SAVE RESULT ================= */
    await Order.findByIdAndUpdate(orderId, {
      aiReport: aiOk
        ? {
            filename: "AI Report",
            storedName: aiUrl,
            percentage: Number(data.ai_score) || 0
          }
        : undefined,

      plagReport: plagOk
        ? {
            filename: "Plagiarism Report",
            storedName: simUrl,
            percentage: Number(data.similarity_score) || 0
          }
        : undefined,

      status,
      completedAt: new Date(),
      processing: false
    });

    /* ================= CREDIT DEDUCTION (ONCE) ================= */
    const freshOrder = await Order.findById(orderId);
    if (!freshOrder.creditDeducted) {
      await User.updateOne(
        { email: freshOrder.email },
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
    console.error(
      "❌ PLAGX ERROR:",
      err.response?.data || err.message
    );

    const latest = await Order.findById(orderId);

    /* ================= FINAL FAIL ================= */
    if (latest.retryCount >= 2) {
      await Order.findByIdAndUpdate(orderId, {
        status: "failed",
        processing: false
      });
      console.warn("🛑 ORDER FAILED:", orderId);
      return;
    }

    /* ================= ALLOW RETRY ================= */
    await Order.findByIdAndUpdate(orderId, {
      processing: false
    });
  }
}
