import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

/* ================= ROUTES ================= */

// USER ROUTES
import uploadRoute from "./routes/upload.js";
import authRoute from "./routes/auth.js";
import userReportsRoute from "./routes/userReports.js";
import userStatusRoutes from "./routes/userStatus.js";
import accountRoutes from "./routes/account.js";
import validateEmailRoute from "./routes/validateEmail.js";

// ADMIN ROUTES
import adminAuthRoute from "./routes/adminAuth.js";
import adminUploadRoute from "./routes/adminUpload.js";
import adminOrdersRoute from "./routes/adminOrders.js";
import adminDeleteReportRoute from "./routes/adminDeleteReport.js";
import adminStatsRoute from "./routes/adminStats.js";
import deductCreditRoute from "./routes/deductCredit.js";

// WEBHOOKS
import sellWebhook from "./routes/sellWebhook.js";
import turnitinCallbackRoute from "./routes/turnitinCallback.js";

// API (RENTABLE)
import apiCreditsRoute from "./routes/apiCredits.js";
import plagCheckRoute from "./routes/plagCheck.js";

/* ================= CORE ================= */
import connectDB from "./db.js";
import Order from "./models/Order.js";
import { processDocument } from "./services/processor.js";

const app = express();

/* ================= GLOBAL QUEUE LOCK ================= */
let queueBusy = false;

/* ================= CORS ================= */
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"]
  })
);

/* ================= WEBHOOK (RAW BODY ONLY WHERE NEEDED) ================= */
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
app.use("/api", validateEmailRoute);

/* ================= RENTABLE API ================= */
app.use("/api/plag", plagCheckRoute);
app.use("/api/plag", apiCreditsRoute);

/* ================= ADMIN APIs ================= */
app.use("/api/admin", adminAuthRoute);
app.use("/api/admin", adminUploadRoute);
app.use("/api/admin", adminOrdersRoute);
app.use("/api/admin", adminDeleteReportRoute);
app.use("/api/admin", adminStatsRoute);
app.use("/api", deductCreditRoute);

/* ================= TURNITIN CALLBACK ================= */
/**
 * Turnitin will POST here:
 * https://plagxdetector.com/api/turnitin/callback
 */
app.use("/api", turnitinCallbackRoute);

/* ================= PAGES ================= */
app.get("/admin/login.html", (_, res) =>
  res.sendFile(path.join(frontendPath, "admin/login.html"))
);

app.get("/admin/dashboard.html", (_, res) =>
  res.sendFile(path.join(frontendPath, "admin/dashboard.html"))
);

/* ================= MONGODB QUEUE WORKER ================= */
/**
 * - MongoDB acts as queue
 * - ONE order at a time
 * - Retry ONLY once
 * - Global lock prevents overlap
 */
setInterval(async () => {
  if (queueBusy) return;
  queueBusy = true;

  try {
    const order = await Order.findOneAndUpdate(
      {
        status: "pending",
        processing: false,
        retryCount: { $lt: 2 }
      },
      { processing: true },
      {
        sort: { createdAt: 1 }, // FIFO
        new: true
      }
    );

    if (!order) return;

    console.log("🧵 QUEUE PICKED ORDER:", order._id);

    await processDocument(order._id, order.fileURL);

  } catch (err) {
    console.error("❌ QUEUE WORKER ERROR:", err.message);
  } finally {
    queueBusy = false; // 🔓 unlock
  }
}, 15000);

/* ================= START ================= */
app.listen(5000, () => {
  console.log("✅ Server running on port 5000");
});
