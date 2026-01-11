import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    /* ================= SOURCE ================= */
    source: {
      type: String,
      enum: ["website", "api"],
      default: "website"
    },

    /* ================= USER REFERENCES ================= */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    apiUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApiUser"
    },

    /* ================= USER INFO ================= */
    email: {
      type: String,
      required: true
    },

    filename: {
      type: String
    },

    storedName: {
      type: String
    },

    fileURL: {
      type: String,
      required: true
    },

    /* ================= PROVIDER INFO ================= */
    provider: {
      type: String
    },

    providerRef: {
      type: String
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
      enum: ["pending", "processing", "partial", "completed", "failed"],
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
      default: 0
    },

    /* ================= TIMESTAMPS ================= */
    completedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
