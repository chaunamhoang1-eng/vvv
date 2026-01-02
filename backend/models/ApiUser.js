import mongoose from "mongoose";

const apiUserSchema = new mongoose.Schema({
  name: String,
  email: String,

  apiKey: {
    type: String,
    unique: true,
    required: true
  },

  credits: {
    type: Number,
    default: 0
  },

  totalUsed: {
    type: Number,
    default: 0
  },

  status: {
    type: String,
    enum: ["active", "blocked"],
    default: "active"
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  lastUsedAt: Date
});

export default mongoose.model("ApiUser", apiUserSchema);
