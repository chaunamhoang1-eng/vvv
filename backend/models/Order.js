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

    aiReport: {
      filename: String,
      storedName: String
    },

    plagReport: {
      filename: String,
      storedName: String
    },

    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
