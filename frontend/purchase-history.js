import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

/* ======================================================
   FIREBASE CONFIG
====================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyAbvVgUW6H3sJBY3Sng7JSCzyBFN1PxrnQ",
  authDomain: "login-98c26.firebaseapp.com",
  projectId: "login-98c26",
  storageBucket: "login-98c26.firebasestorage.app",
  messagingSenderId: "199892612420",
  appId: "1:199892612420:web:db0aeb5bd145f335955311"
};


/* ======================================================
   INITIALIZE FIREBASE
====================================================== */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);


/* ======================================================
   DOM
====================================================== */

const historyList =
  document.getElementById("purchaseHistoryList");


/* ======================================================
   LOADING
====================================================== */

function showLoading() {

  if (!historyList) return;

  historyList.innerHTML = `
    <div class="purchase-loading">
      Loading purchase history...
    </div>
  `;
}


/* ======================================================
   ERROR
====================================================== */

function showError(message) {

  if (!historyList) return;

  historyList.innerHTML = `
    <div class="purchase-error">
      ❌ ${message}
      <br><br>
      <button onclick="loadPurchaseHistory()">
        Try Again
      </button>
    </div>
  `;
}


/* ======================================================
   EMPTY
====================================================== */

function showEmpty() {

  if (!historyList) return;

  historyList.innerHTML = `
    <div class="purchase-empty">
      🧾 No purchases found.
    </div>
  `;
}


/* ======================================================
   FORMAT DATE
====================================================== */

function formatDate(date) {

  if (!date) return "—";

  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}


/* ======================================================
   FORMAT AMOUNT
====================================================== */

function formatAmount(amount, currency) {

  if (
    amount === undefined ||
    amount === null ||
    amount === ""
  ) {
    return "—";
  }

  return `${currency || "USD"} ${amount}`;
}


/* ======================================================
   LOAD PURCHASE HISTORY
====================================================== */

async function loadPurchaseHistory() {

  try {

    showLoading();

    const user = auth.currentUser;

    if (!user) {

      showError(
        "You are not logged in."
      );

      return;
    }


    /*
      Get a fresh Firebase ID token.
      This token is sent to your backend.
    */

    const token =
      await user.getIdToken(true);


    console.log(
      "📧 Loading purchase history for:",
      user.email
    );


    const response =
      await fetch(
        "/api/purchase-history",
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${token}`,

            "Content-Type":
              "application/json"
          }
        }
      );


    console.log(
      "Purchase history status:",
      response.status
    );


    if (!response.ok) {

      const errorText =
        await response.text();

      console.error(
        "Purchase history API error:",
        errorText
      );

      throw new Error(
        `Server returned ${response.status}`
      );
    }


    const data =
      await response.json();


    console.log(
      "Purchase history response:",
      data
    );


    if (
      !data.success ||
      !Array.isArray(data.purchases)
    ) {

      throw new Error(
        "Invalid purchase history response"
      );
    }


    if (
      data.purchases.length === 0
    ) {

      showEmpty();

      return;
    }


    renderPurchases(
      data.purchases
    );


  } catch (error) {

    console.error(
      "❌ Purchase history error:",
      error
    );

    showError(
      "Unable to load purchase history."
    );
  }
}


/* ======================================================
   RENDER PURCHASES
====================================================== */

function renderPurchases(
  purchases
) {

  if (!historyList) return;


  historyList.innerHTML = "";


  purchases.forEach(
    (purchase) => {

      const card =
        document.createElement("div");

      card.className =
        "purchase-card";


      card.innerHTML = `
        <div class="purchase-main">

          <div class="purchase-product">
            ${escapeHtml(
              purchase.productTitle ||
              "PlagX Purchase"
            )}
          </div>

          <div class="purchase-date">
            ${formatDate(
              purchase.createdAt
            )}
          </div>

        </div>


        <div class="purchase-details">

          <div>
            <span class="purchase-label">
              Credits
            </span>

            <strong>
              +${purchase.credits ?? 0}
            </strong>
          </div>


          <div>
            <span class="purchase-label">
              Amount
            </span>

            <strong>
              ${formatAmount(
                purchase.amount,
                purchase.currency
              )}
            </strong>
          </div>


          <div>
            <span class="purchase-label">
              Payment ID
            </span>

            <strong class="payment-id">
              ${escapeHtml(
                purchase.paymentId ||
                "—"
              )}
            </strong>
          </div>

        </div>
      `;


      historyList.appendChild(
        card
      );

    }
  );
}


/* ======================================================
   BASIC HTML ESCAPE
====================================================== */

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* ======================================================
   AUTH
====================================================== */

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) {

      window.location.href =
        "/login.html";

      return;
    }


    console.log(
      "✅ Firebase user:",
      user.email
    );


    await loadPurchaseHistory();

  }
);


/* ======================================================
   GLOBAL BUTTON FUNCTION
====================================================== */

window.loadPurchaseHistory =
  loadPurchaseHistory;


/* ======================================================
   CLOSE
====================================================== */

window.closePurchaseHistory =
  () => {

    window.close();

  };
