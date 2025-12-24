import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import uploadRoute from "./routes/upload.js";
import authRoute from "./routes/auth.js";
import connectDB from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

// Connect Database
connectDB();

// Fix ES module path issues
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Frontend folder path
const frontendPath = path.join(__dirname, "..", "frontend");

// Serve static frontend files
app.use(express.static(frontendPath));

/* ================= API ROUTES ================= */
app.use("/api", uploadRoute);
app.use("/auth", authRoute);

/* ================= STATIC HTML ROUTES ================= */
app.get("/login.html", (_, res) => res.sendFile(path.join(frontendPath, "login.html")));
app.get("/register.html", (_, res) => res.sendFile(path.join(frontendPath, "register.html")));
app.get("/forgot.html", (_, res) => res.sendFile(path.join(frontendPath, "forgot.html")));
app.get("/reset.html", (_, res) => res.sendFile(path.join(frontendPath, "reset.html")));

/* ================= CATCH ALL ================= */
app.get("*", (_, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
