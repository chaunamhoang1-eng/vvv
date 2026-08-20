import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    // Password required ONLY for non-Firebase users
    password: {
      type: String,
      required: function () {
        return !this.firebaseUid;
      }
    },

    // Firebase UID
    firebaseUid: {
      type: String,
      index: true,
      default: null
    },

    // Email / OTP verification
    isVerified: {
      type: Boolean,
      default: true
    },

    // OTP security fields
    otpHash: {
      type: String,
      default: null
    },

    otpExpires: {
      type: Date,
      default: null
    },

    otpAttempts: {
      type: Number,
      default: 0
    },

    otpLastSent: {
      type: Date,
      default: null
    },

    // Reset password token
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
    },

    /* ================= REFERRAL LOGIC ================= */

    // Unique referral code for this user
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
      default: null
    },

    // User who referred this account
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    // Track whether this user has already earned
    // the referral reward
    referralRewarded: {
      type: Boolean,
      default: false
    },

    // Total referral rewards earned
    referralRewards: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("User", userSchema);
