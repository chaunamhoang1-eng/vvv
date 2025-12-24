import express from "express";
import User from "../models/user.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import nodemailer from "nodemailer";

const router = express.Router();

/* ===================== REGISTER ===================== */
router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const hashed = await bcrypt.hash(password, 10);
    await new User({ email, password: hashed }).save();

    res.json({ message: "User Registered Successfully" });
  } catch (error) {
    res.status(500).json({ error: "Server error during registration" });
  }
});

/* ===================== LOGIN ===================== */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid password" });

    res.json({ message: "Login Success" });
  } catch (error) {
    res.status(500).json({ error: "Server error during login" });
  }
});

/* ===================== FORGOT PASSWORD ===================== */
router.post("/forgot", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    // Do not reveal if user exists
    if (!user) {
      return res.json({ message: "If the email exists, a reset link was sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");

    user.resetToken = token;
    user.resetTokenExpire = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetLink = `http://localhost:5000/reset.html?token=${token}`;

    // Email sender setup
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "YOUR_EMAIL@gmail.com",     // <-- CHANGE THIS
        pass: "YOUR_APP_PASSWORD"         // <-- CHANGE THIS
      }
    });

    await transporter.sendMail({
      to: email,
      subject: "PlagX Password Reset",
      html: `
        <h3>Password Reset Request</h3>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}" target="_blank">${resetLink}</a>
        <p>This link is valid for 1 hour.</p>
      `
    });

    res.json({ message: "If the email exists, a reset link was sent." });

  } catch (error) {
    res.status(500).json({ error: "Error sending reset link" });
  }
});

/* ===================== RESET PASSWORD ===================== */
router.post("/reset", async (req, res) => {
  const { token, password } = req.body;

  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const hashed = await bcrypt.hash(password, 10);

    user.password = hashed;
    user.resetToken = undefined;
    user.resetTokenExpire = undefined;

    await user.save();

    res.json({ message: "Password updated successfully!" });

  } catch (error) {
    res.status(500).json({ error: "Error resetting password" });
  }
});

/* ===================== EXPORT ===================== */
export default router;
