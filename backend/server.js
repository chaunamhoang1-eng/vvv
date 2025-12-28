import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import session from "express-session";
import { fileURLToPath } from "url";

import uploadRoute from "./routes/upload.js";
import authRoute from "./routes/auth.js";
import adminAuthRoute from "./routes/adminAuth.js";
import adminUploadRoute from "./routes/adminUpload.js";
import userReportsRoute from "./routes/userReports.js";
import adminOrdersRoute from "./routes/adminOrders.js";
import adminDeleteReportRoute from "./routes/adminDeleteReport.js";
import adminStatsRoute from "./routes/adminStats.js";
import userStatusRoutes from "./routes/userStatus.js";
import sellWebhook from "./routes/sellWebhook.js";
import accountRoutes from "./routes/account.js";
import connectDB from "./db.js";

const app = express();

/* ================= CORS ================= */
app.use(cors({
  origin: true,
  credentials: true
}));

/* ================= WEBHOOK (RAW BODY) ================= */
// ⚠️ MUST be before express.json()
app.use(
  "/api/webhook",
  express.raw({ type: "application/json" }),
  sellWebhook
);

/* ================= BODY PARSERS ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= SESSION ================= */
app.use(session({
  secret: "plagx_admin_secret_key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
  }
}));

/* ================= DATABASE ================= */
connectDB();

/* ================= PATH ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "..", "frontend");

/* ================= STATIC ================= */
app.use(express.static(frontendPath));

/* ================= USER APIs ================= */
app.use("/api", uploadRoute);
app.use("/api", userReportsRoute);
app.use("/auth", authRoute);
app.use("/api/user", userStatusRoutes);
app.use("/api/account", accountRoutes);

/* ================= ADMIN APIs ================= */
app.use("/api/admin", adminAuthRoute);
app.use("/api/admin", adminUploadRoute);
app.use("/api/admin", adminOrdersRoute);
app.use("/api/admin", adminDeleteReportRoute);
app.use("/api/admin", adminStatsRoute);

/* ================= PAGES ================= */
app.get("/admin/login.html", (_, res) =>
  res.sendFile(path.join(frontendPath, "admin/login.html"))
);

app.get("/admin/dashboard.html", (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/admin/login.html");
  }
  res.sendFile(path.join(frontendPath, "admin/dashboard.html"));
});

/* ================= START ================= */
app.listen(5000, () => {
  console.log("✅ Server running at http://localhost:5000");
});
