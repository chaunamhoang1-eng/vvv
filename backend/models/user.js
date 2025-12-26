import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true
    },

    password: {
      type: String,
      required: true
    },

    // Reset password token
    resetToken: {
      type: String,
      default: null
    },

    // Expiry time for token
    resetTokenExpire: {
      type: Date,
      default: null
    },

    /* ================= PURCHASE LOGIC ================= */

    hasPurchased: {
      type: Boolean,
      default: false
    },

    credits: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
