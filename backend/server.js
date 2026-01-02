import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

/* ===== EXISTING ROUTES ===== */
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

/* ===== NEW RENTABLE API ROUTE ===== */
import plagCheckRoute from "./routes/plagCheck.js";

import connectDB from "./db.js";

const app = express();

/* ================= CORS ================= */
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"]
}));

/* ================= WEBHOOK ================= */
app.use(
  "/api/webhook",
  express.raw({ type: "application/json" }),
  sellWebhook
);

/* ================= BODY PARSERS ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

/* ================= RENTABLE API (API KEY) ================= */
app.use("/api/plag", plagCheckRoute);

/* ================= ADMIN APIs (JWT) ================= */
app.use("/api/admin", adminAuthRoute);
app.use("/api/admin", adminUploadRoute);
app.use("/api/admin", adminOrdersRoute);
app.use("/api/admin", adminDeleteReportRoute);
app.use("/api/admin", adminStatsRoute);

/* ================= PAGES ================= */
app.get("/admin/login.html", (_, res) =>
  res.sendFile(path.join(frontendPath, "admin/login.html"))
);

app.get("/admin/dashboard.html", (_, res) =>
  res.sendFile(path.join(frontendPath, "admin/dashboard.html"))
);

/* ================= START ================= */
app.listen(5000, () => {
  console.log("✅ Server running at http://localhost:5000");
});
