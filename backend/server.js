import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

/* ================= FIREBASE ADMIN (INIT ONCE) ================= */
import "./utils/firebaseAdmin.js";
import firebaseAuth from "./middleware/firebaseAuth.js";
import plagResultRoute from "./routes/plagResult.js";

/* ================= ROUTES ================= */

// USER
import uploadRoute from "./routes/upload.js";
import userReportsRoute from "./routes/userReports.js";
import userStatusRoutes from "./routes/userStatus.js";
import accountRoutes from "./routes/account.js";
import userCallback from "./routes/originUserCallback.js";

// PUBLIC
import authRoute from "./routes/auth.js";
import validateEmailRoute from "./routes/validateEmail.js";

// ADMIN
import adminAuthRoute from "./routes/adminAuth.js";
import adminUploadRoute from "./routes/adminUpload.js";
import adminOrdersRoute from "./routes/adminOrders.js";
import adminDeleteReportRoute from "./routes/adminDeleteReport.js";
import adminStatsRoute from "./routes/adminStats.js";
import deductCreditRoute from "./routes/deductCredit.js";

// WEBHOOK
import sellWebhook from "./routes/sellWebhook.js";

// RENTABLE API
import apiCreditsRoute from "./routes/apiCredits.js";
import plagCheckRoute from "./routes/plagCheck.js";

/* ================= CORE ================= */
import connectDB from "./db.js";
import Order from "./models/Order.js";
import { processDocument } from "./services/processor.js";

/* ================= SUDOKU ROUTES (NEW) ================= */
import sudokuRoutes from "./routes/sudokuRoutes.js";

const app = express();

/* ================= CORS ================= */
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"]
  })
);

app.use("/api/v1/plag", plagResultRoute);

/* ================= WEBHOOK (RAW BODY) ================= */
app.use(
  "/api/webhook",
  express.raw({ type: "application/json" }),
  sellWebhook
);
app.use("/api/webhook", userCallback);

/* ================= BODY PARSERS ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= DATABASE ================= */
connectDB();

/* ================= STATIC FILES ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));

/* ======================================================
   🌍 PUBLIC ROUTES (NO FIREBASE AUTH)
====================================================== */
app.use("/auth", authRoute);
app.use("/api", validateEmailRoute);

/* ======================================================
   🟢 RENTABLE API (NO FIREBASE AUTH)
====================================================== */
app.use("/api/v1/plag", plagCheckRoute);
app.use("/api/v1/plag", apiCreditsRoute);
app.use("/api/v1/plag", plagResultRoute);

/* ======================================================
   🔑 ADMIN ROUTES
====================================================== */
app.use("/api/admin", adminAuthRoute);
app.use("/api/admin", adminUploadRoute);
app.use("/api/admin", adminOrdersRoute);
app.use("/api/admin", adminDeleteReportRoute);
app.use("/api/admin", adminStatsRoute);
app.use("/api", deductCreditRoute);

/* ======================================================
   🔐 USER ROUTES (🔥 FIREBASE AUTH APPLIED ONCE)
====================================================== */
app.use("/api", firebaseAuth);

app.use("/api", uploadRoute);
app.use("/api/reports", userReportsRoute);
app.use("/api/user", userStatusRoutes);
app.use("/api/account", accountRoutes);

/* ======================================================
   🧩 SUDOKU ROUTES (NEW)
====================================================== */
app.use("/api/sudoku", sudokuRoutes);

/* ================= QUEUE WORKER ================= */
let queueBusy = false;

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
      { sort: { createdAt: 1 }, new: true }
    );

    if (!order) return;

    console.log("🧵 QUEUE PICKED ORDER:", order._id);
    await processDocument(order._id, order.fileURL);

  } catch (err) {
    console.error("❌ QUEUE WORKER ERROR:", err.message);
  } finally {
    queueBusy = false;
  }
}, 15000);

/* ================= START ================= */
app.listen(5000, () => {
  console.log("✅ Server running at http://localhost:5000");
});
