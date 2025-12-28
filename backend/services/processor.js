import axios from "axios";
import Order from "../models/Order.js";

const API_KEY = "nitin"; // 👉 move to .env in production
const API_BASE_URL = "https://td-turnitin.vercel.app";

const POLL_INTERVAL = 5000; // 5 seconds
const MAX_TRIES = 24;       // ~2 minutes total

export async function processDocument(orderId, fileURL) {
  try {
    console.log("⚙️ AUTO API START:", orderId);

    /* ================= SUBMIT DOCUMENT ================= */
    const submitRes = await axios.post(
      `${API_BASE_URL}/submit`,
      new URLSearchParams({ url: fileURL }),
      {
        headers: {
          "X-Auth-Code": API_KEY,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    const submissionId = submitRes.data?.submission_id;

    if (!submissionId) {
      console.error("❌ No submission_id returned");
      return; // stay pending
    }

    console.log("📨 Submission ID:", submissionId);

    /* ================= POLLING LOOP ================= */
    let tries = 0;

    while (tries < MAX_TRIES) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      tries++;

      const statusRes = await axios.get(
        `${API_BASE_URL}/receive/${submissionId}`,
        {
          headers: {
            "X-Auth-Code": API_KEY
          }
        }
      );

      const data = statusRes.data;
      console.log("🔄 Poll result:", data.status);

      /* ================= SUCCESS ================= */
      if (data.status === "done") {
        console.log("✅ API DONE:", orderId);

        await Order.findByIdAndUpdate(orderId, {
          aiReport: {
            filename: "AI Report",
            storedName: data.ai_report_url,
            percentage: Number(data.ai_index) || 0
          },
          plagReport: {
            filename: "Plagiarism Report",
            storedName: data.similarity_report_url,
            percentage: Number(data.similarity_index) || 0
          },
          status: "completed"
        });

        console.log("✅ API RESULT SAVED:", orderId);
        return;
      }

      /* ================= API ERROR ================= */
      if (data.status === "error") {
        console.error("❌ API ERROR:", data.error);
        return; // stay pending → manual upload allowed
      }
    }

    /* ================= TIMEOUT ================= */
    console.error("⏱️ API TIMEOUT:", orderId);
    // order remains pending

  } catch (err) {
    console.error("❌ AUTO PROCESS FAILED:", err.message);
    // order remains pending
  }
}
