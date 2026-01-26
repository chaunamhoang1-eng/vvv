import mongoose from "mongoose";

const apiUserSchema = new mongoose.Schema({
  name: String,
  email: String,

  apiKey: {
    type: String,
    unique: true,
    required: true
  },

  activationCode: {
    type: String,
    unique: true
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

  callbackURL: {
    type: String,
    default: null   // <—— REQUIRED for CALLBACK FEATURE
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  lastUsedAt: Date
});

export default mongoose.model("ApiUser", apiUserSchema);
