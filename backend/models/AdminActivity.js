import mongoose from "mongoose";

const adminActivitySchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true
    },
    type: {
      type: String,
      enum: ["ai", "plag"],
      required: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("AdminActivity", adminActivitySchema);
