import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // hash later
  totalCompleted: { type: Number, default: 0 },
  totalPending: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model("Admin", adminSchema);
