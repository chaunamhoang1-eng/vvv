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
 * - Failure keeps order pending for admin/manual
 */
export async function processDocument(orderId, fileURL) {
  console.log("⚙️ PLAGX PROCESS START:", orderId);

  const order = await Order.findById(orderId);
  if (!order) return;

  // 🔒 Safety: do not reprocess completed orders
  if (order.status === "completed" || order.creditDeducted) {
    await Order.findByIdAndUpdate(orderId, { processing: false });
    return;
  }

  try {
    // 🔁 increment attempt count
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

    /* ================= HARD FAIL ================= */
    if (!data || data.success !== true) {
      throw new Error("PlagX rejected request");
    }

    const aiUrl = data.outputs?.ai_url || null;
    const simUrl = data.outputs?.similarity_url || null;

    const aiOk = !!aiUrl;
    const plagOk = !!simUrl;

    // ❌ Nothing generated → retry allowed
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

    console.log(
      `✅ ORDER ${status.toUpperCase()}:`,
      orderId
    );

  } catch (err) {
    console.error(
      "❌ PLAGX ERROR:",
      err.response?.data || err.message
    );

    /* ================= RETRY SAFETY ================= */
    const latest = await Order.findById(orderId);

    // 🛑 Stop retrying after 2 attempts
    if (latest.retryCount >= 2) {
      console.warn("🛑 Max retry reached:", orderId);
    }

    await Order.findByIdAndUpdate(orderId, {
      processing: false
    });

    // ❗ stays pending
    // ❗ no credit deducted
    // ❗ admin manual upload allowed
  }
}
