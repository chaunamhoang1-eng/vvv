// models/ApiOrder.js
import mongoose from "mongoose";

const apiOrderSchema = new mongoose.Schema({
  apiKey: { type: String, required: true },
  callbackURL: { type: String, default: null },

  fileURL: { type: String, required: true },
  filename: { type: String },
  storedName: { type: String },

  historyId: { type: String },

  status: {
    type: String,
    enum: ["pending", "processing", "completed", "failed", "timeout"],
    default: "pending"
  },

  processing: { type: Boolean, default: false },

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

  creditDeducted: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

export default mongoose.model("ApiOrder", apiOrderSchema);
