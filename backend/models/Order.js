import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      index: true,
      required: false
    },

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
      enum: ["pending", "processing", "completed", "partial", "timeout", "failed"],
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

    completedBy: {
      type: String,  // "api" | "admin1" | "system"
      default: null
    },

    source: {
      type: String,
      enum: ["website", "api"],
      default: "website"
    },

    discord_messages: [
      {
        url: String,
        messageId: String
      }
    ]
  },
  { timestamps: true }
);

// Prevent duplicate orders for same file
orderSchema.index(
  { email: 1, fileURL: 1 },
  { unique: true }
);

export default mongoose.model("Order", orderSchema);
