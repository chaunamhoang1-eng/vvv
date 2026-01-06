import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    /* ================= USER INFO ================= */
    email: {
      type: String,
      required: true
    },

    filename: {
      type: String,
      required: true
    },

    storedName: {
      type: String,
      required: true
    },

    fileURL: {
      type: String,
      required: true
    },

    /* ================= REPORTS ================= */
    aiReport: {
      filename: String,
      storedName: String,
      percentage: Number
    },

    plagReport: {
      filename: String,
      storedName: String,
      percentage: Number
    },

    /* ================= STATUS ================= */
    status: {
      type: String,
      enum: ["pending", "partial", "completed"],
      default: "pending"
    },

    /* ================= QUEUE LOCK ================= */
    processing: {
      type: Boolean,
      default: false
    },

    /* ================= BILLING SAFETY ================= */
    creditDeducted: {
      type: Boolean,
      default: false
    },

    /* ================= RETRY SAFETY ================= */
    retryCount: {
      type: Number,
      default: 0 // 🔁 allow ONLY 1 retry (max 2 attempts)
    },

    /* ================= TIMESTAMPS ================= */
    completedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
