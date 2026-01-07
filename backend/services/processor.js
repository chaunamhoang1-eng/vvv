import axios from "axios";
import Order from "../models/Order.js";
import User from "../models/user.js";

/* ================= CONFIG ================= */
const PLAGX_API_URL = "https://vvv-ch7d.onrender.com/api/plag/check";
const PLAGX_API_KEY = process.env.PLAGX_API_KEY;

/* ================= PROCESS DOCUMENT ================= */
export async function processDocument(orderId, fileURL) {
  console.log("⚙️ PLAGX PROCESS START:", orderId);

  let order;

  try {
    order = await Order.findById(orderId);
    if (!order) return;

    /* ================= HARD EXIT ================= */
    if (
      order.status === "completed" ||
      order.status === "partial" ||
      order.status === "failed" ||
      order.creditDeducted
    ) {
      return;
    }

    /* ================= CALL PLAGX API ================= */
    const res = await axios.post(
      PLAGX_API_URL,
      { file_url: fileURL },
      {
        headers: {
          "X-API-Key": PLAGX_API_KEY,
          "Content-Type": "application/json"
        },
        timeout: 35 * 60 * 1000 // ⏱️ slightly higher than expected max
      }
    );

    const data = res.data;

    /* ================= HARD API REJECT ================= */
    if (!data || data.success !== true) {
      throw new Error("PlagX rejected request");
    }

    const aiUrl = data.outputs?.ai_url || null;
    const simUrl = data.outputs?.similarity_url || null;

    const aiOk = Boolean(aiUrl);
    const plagOk = Boolean(simUrl);

    /* ================= STILL PROCESSING ================= */
    if (!aiOk && !plagOk) {
      console.log("⏳ Still processing, keep pending:", orderId);
      return; // ❗ DO NOT retry, DO NOT fail
    }

    /* ================= STATUS ================= */
    const status = aiOk && plagOk ? "completed" : "partial";

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
      completedAt: new Date()
    });

    /* ================= CREDIT DEDUCTION (ONCE) ================= */
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
    console.error(
      "❌ PLAGX ERROR:",
      err.response?.data || err.message
    );

    /* ================= REAL FAILURE ONLY ================= */
    const latest = await Order.findById(orderId);

    if (latest && latest.retryCount >= 1) {
      await Order.findByIdAndUpdate(orderId, {
        status: "failed"
      });
      console.warn("🛑 ORDER FAILED:", orderId);
      return;
    }

    await Order.findByIdAndUpdate(orderId, {
      $inc: { retryCount: 1 }
    });

  } finally {
    /* ================= ALWAYS UNLOCK ================= */
    await Order.findByIdAndUpdate(orderId, {
      processing: false
    });
  }
}
