import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

/* ======================================================
   FIREBASE ADMIN (INIT ONCE)
====================================================== */

import "./utils/firebaseAdmin.js";
import firebaseAuth from "./middleware/firebaseAuth.js";

/* ======================================================
   ROUTES
====================================================== */

// USER
import uploadRoute from "./routes/upload.js";
import userReportsRoute from "./routes/userReports.js";
import userStatusRoutes from "./routes/userStatus.js";
import accountRoutes from "./routes/account.js";
import userCallback from "./routes/originUserCallback.js";
import purchaseHistoryRoute from "./routes/purchaseHistory.js";
import referralRoutes from "./routes/referral.js";

// PUBLIC
import authRoute from "./routes/auth.js";
import otpRoute from "./routes/otp.js";
import validateEmailRoute from "./routes/validateEmail.js";
import turnstileRoute from "./routes/turnstile.js";

// PLAGIARISM RESULT
import plagResultRoute from "./routes/plagResult.js";

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

// SUDOKU
import sudokuRoutes from "./routes/sudokuRoutes.js";

/* ======================================================
   CORE
====================================================== */

import connectDB from "./db.js";
import Order from "./models/Order.js";
import { processDocument } from "./services/processor.js";


/* ======================================================
   EXPRESS APP
====================================================== */

const app = express();


/* ======================================================
   CONTENT SECURITY POLICY
   FIREBASE + CLOUDFLARE TURNSTILE
====================================================== */

app.use((req, res, next) => {

  res.setHeader(
    "Content-Security-Policy",

    [
      "default-src 'self'",

      "script-src 'self' 'unsafe-inline' 'unsafe-eval' " +
        "https://www.gstatic.com " +
        "https://www.googleapis.com " +
        "https://cdn.jsdelivr.net " +
        "https://challenges.cloudflare.com",

      "frame-src 'self' " +
        "https://challenges.cloudflare.com",

      "connect-src 'self' " +
        "https://www.googleapis.com " +
        "https://securetoken.googleapis.com " +
        "https://identitytoolkit.googleapis.com " +
        "https://challenges.cloudflare.com",

      "worker-src 'self' blob:",

      "style-src 'self' 'unsafe-inline' " +
        "https://fonts.googleapis.com",

      "font-src 'self' " +
        "https://fonts.gstatic.com",

      "img-src 'self' data: https:",

      "base-uri 'self'",

      "form-action 'self'"
    ].join("; ")
  );

  next();

});


/* ======================================================
   CORS
====================================================== */

app.use(
  cors({
    origin: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE"
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-API-Key"
    ]
  })
);


/* ======================================================
   PLAG RESULT ROUTE
====================================================== */

app.use(
  "/api/v1/plag",
  plagResultRoute
);


/* ======================================================
   SELLAPP WEBHOOK
   RAW BODY MUST BE USED HERE
====================================================== */

app.use(
  "/api/webhook",

  express.raw({
    type: "application/json"
  }),

  sellWebhook
);


/* ======================================================
   USER CALLBACK WEBHOOK
====================================================== */

app.use(
  "/api/webhook",
  userCallback
);


/* ======================================================
   BODY PARSERS
====================================================== */

app.use(
  express.json()
);

app.use(
  express.urlencoded({
    extended: true
  })
);


/* ======================================================
   DATABASE
====================================================== */

connectDB();


/* ======================================================
   STATIC FILES
====================================================== */

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const frontendPath =
  path.join(
    __dirname,
    "..",
    "frontend"
  );

app.use(
  express.static(frontendPath)
);


/* ======================================================
   HUMANIZER PAGE
====================================================== */

app.get(
  "/humanize",
  (req, res) => {

    res.sendFile(
      path.join(
        frontendPath,
        "humanize.html"
      )
    );

  }
);


/* ======================================================
   PUBLIC ROUTES
   NO FIREBASE AUTH
====================================================== */

app.use(
  "/auth",
  authRoute
);

app.use(
  "/auth",
  otpRoute
);


/* ======================================================
   CLOUDFLARE TURNSTILE
====================================================== */

app.use(
  "/auth",
  turnstileRoute
);


app.use(
  "/api",
  validateEmailRoute
);


/* ======================================================
   SUDOKU ROUTES
   PUBLIC
====================================================== */

app.use(
  "/api/sudoku",
  sudokuRoutes
);


/* ======================================================
   RENTABLE API
   NO FIREBASE AUTH
====================================================== */

app.use(
  "/api/v1/plag",
  plagCheckRoute
);

app.use(
  "/api/v1/plag",
  apiCreditsRoute
);


/* ======================================================
   ADMIN ROUTES
====================================================== */

app.use(
  "/api/admin",
  adminAuthRoute
);

app.use(
  "/api/admin",
  adminUploadRoute
);

app.use(
  "/api/admin",
  adminOrdersRoute
);

app.use(
  "/api/admin",
  adminDeleteReportRoute
);

app.use(
  "/api/admin",
  adminStatsRoute
);

app.use(
  "/api",
  deductCreditRoute
);


/* ======================================================
   USER ROUTES
   FIREBASE AUTH STARTS HERE
====================================================== */

app.use(
  "/api",
  firebaseAuth
);


/* ======================================================
   REFERRAL ROUTES
   FIREBASE AUTH REQUIRED
====================================================== */

app.use(
  "/api/referral",
  referralRoutes
);


/* ======================================================
   PURCHASE HISTORY
====================================================== */

app.use(
  "/api",
  purchaseHistoryRoute
);


/* ======================================================
   OTHER AUTHENTICATED USER ROUTES
====================================================== */

app.use(
  "/api",
  uploadRoute
);

app.use(
  "/api/reports",
  userReportsRoute
);

app.use(
  "/api/user",
  userStatusRoutes
);

app.use(
  "/api/account",
  accountRoutes
);


/* ======================================================
   QUEUE WORKER
====================================================== */

let queueBusy = false;


setInterval(

  async () => {

    if (queueBusy) {
      return;
    }


    queueBusy = true;


    try {

      const order =
        await Order.findOneAndUpdate(

          {
            status: "pending",

            processing: false,

            retryCount: {
              $lt: 2
            }
          },

          {
            processing: true
          },

          {
            sort: {
              createdAt: 1
            },

            new: true
          }

        );


      if (!order) {
        return;
      }


      console.log(
        "🧵 QUEUE PICKED ORDER:",
        order._id
      );


      await processDocument(
        order._id,
        order.fileURL
      );


    } catch (err) {

      console.error(
        "❌ QUEUE WORKER ERROR:",
        err.message
      );


    } finally {

      queueBusy = false;

    }

  },

  15000

);


/* ======================================================
   START SERVER
====================================================== */

app.listen(

  5000,

  () => {

    console.log(
      "✅ Server running at http://localhost:5000"
    );

  }

);
