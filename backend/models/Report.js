import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  email: { type: String, required: true },

  originalFile: {
    filename: String,
    storedName: String
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
}, { timestamps: true });

export default mongoose.model("Report", reportSchema);
