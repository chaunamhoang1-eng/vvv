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

    credits: {
      type: Number,
      required: true,
      min: 1,
    },

    productTitle: {
      type: String,
      required: true,
    },

    amount: {
      type: Number,
      default: null,
    },

    currency: {
      type: String,
      default: "USD",
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
