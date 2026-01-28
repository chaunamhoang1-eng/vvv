import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
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

    status: {
      type: String,
      enum: ["pending", "processing", "completed", "partial", "timeout"],
      default: "pending"
    },

    processing: {
      type: Boolean,
      default: false
    },

    creditDeducted: {
      type: Boolean,
      default: false
    },

    retryCount: {
      type: Number,
      default: 0
    },

    completedAt: {
      type: Date
    },

    source: {
      type: String,
      enum: ["website", "api"],
      default: "website"
    },

    /* 🆕 IMPORTANT FOR DISCORD UPDATES */
    discord_message_id: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

/* 🔒 Prevent duplicate orders (same user + same file) */
orderSchema.index(
  { email: 1, fileURL: 1 },
  { unique: true }
);

export default mongoose.model("Order", orderSchema);
