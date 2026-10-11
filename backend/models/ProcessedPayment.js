
import mongoose from "mongoose";

const processedPaymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    // Number of credits purchased; must always be at least 1.
    credits: {
      type: Number,
      required: true,
      min: 1,
    },

    productTitle: {
      type: String,
      required: true,
      trim: true,
    },

    // Identifies which balance the webhook should update.
    creditType: {
      type: String,
      enum: ["plagiarism", "humanizer"],
      required: true,
      default: "plagiarism",
    },

    // Tracks payment processing and helps with retry handling.
    creditStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "review"],
      default: "pending",
      required: true,
    },

    amount: {
      type: Number,
      default: null,
    },

    currency: {
      type: String,
      default: "USD",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "ProcessedPayment",
  processedPaymentSchema
);
