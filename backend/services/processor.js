import axios from "axios";
import Order from "../models/Order.js";

/* ================= CONFIG ================= */
const PLAGX_API_URL = "https://vvv-ch7d.onrender.com/api/plag/check";
const PLAGX_API_KEY = process.env.PLAGX_API_KEY; // sk_plagx_client1

/* ================= PROCESS DOCUMENT ================= */
/**
 * RULES:
 * - SUCCESS → order marked COMPLETED
 * - FAILURE / TIMEOUT → order stays PENDING
 * - Admin can manually upload reports anytime
 */
export async function processDocument(orderId, fileURL) {
  console.log("⚙️ PLAGX PROCESS START:", orderId);

  try {
    /* ================= CALL PLAGX API ================= */
    const res = await axios.post(
      PLAGX_API_URL,
      { file_url: fileURL },
      {
        headers: {
          "X-API-Key": PLAGX_API_KEY,
          "Content-Type": "application/json"
        },
        timeout: 10 * 60 * 1000 // 10 minutes max
      }
    );

    const data = res.data;

    /* ================= HARD FAIL → KEEP PENDING ================= */
    if (!data || data.success !== true) {
      console.error("❌ PLAGX FAILED:", data);
      return; // ❗ order stays PENDING
    }

    console.log("✅ PLAGX SUCCESS:", orderId, data.task_id);

    /* ================= SAVE RESULT ================= */
    await Order.findByIdAndUpdate(orderId, {
      aiReport: {
        filename: "AI Report",
        storedName: data.outputs?.ai_url || null,
        percentage: Number(data.ai_score) || 0
      },
      plagReport: {
        filename: "Plagiarism Report",
        storedName: data.outputs?.similarity_url || null,
        percentage: Number(data.similarity_score) || 0
      },
      status: "completed",
      completedAt: new Date()
    });

    console.log("✅ ORDER COMPLETED:", orderId);

  } catch (err) {
    /* ================= ERROR → KEEP PENDING ================= */
    console.error(
      "❌ PLAGX ERROR:",
      err.response?.data || err.message
    );

    // ❗ DO NOTHING HERE
    // ❗ status remains "pending"
    // ❗ admin can upload reports manually
    return;
  }
}
