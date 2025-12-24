import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
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
  }
});

export default mongoose.model("User", userSchema);
