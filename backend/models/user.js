import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true
    },

    // 🔐 Password required ONLY for non-Firebase users
    password: {
      type: String,
      required: function () {
        return !this.firebaseUid; // 👈 key line
      }
    },

    // 🔥 Firebase UID (new auth system)
    firebaseUid: {
      type: String,
      index: true,
      default: null
    },

    // Reset password token (legacy users only)
    resetToken: {
      type: String,
      default: null
    },

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
