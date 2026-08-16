import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";


/* ======================================================
   FIREBASE CONFIG
====================================================== */

const firebaseConfig = {

  apiKey:
    "AIzaSyAbvVgUW6H3sJBY3Sng7JSCzyBFN1PxrnQ",

  authDomain:
    "login-98c26.firebaseapp.com",

  projectId:
    "login-98c26",

  storageBucket:
    "login-98c26.firebasestorage.app",

  messagingSenderId:
    "199892612420",

  appId:
    "1:199892612420:web:db0aeb5bd145f335955311"

};


/* ======================================================
   INITIALIZE FIREBASE
====================================================== */

const app =
  initializeApp(firebaseConfig);

const auth =
  getAuth(app);


/* ======================================================
   DOM
====================================================== */

const historyList =
  document.getElementById(
    "purchaseHistoryList"
  );


/* ======================================================
   LOADING
====================================================== */

function showLoading() {

  if (!historyList) {
    return;
  }

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

  if (!historyList) {
    return;
  }

  historyList.innerHTML = `

    <div class="purchase-error">

      ❌ ${escapeHtml(message)}

      <br>

      <button
        type="button"
        class="retry-history-btn"
        onclick="loadPurchaseHistory()">

        Try Again

      </button>

    </div>

  `;

}


/* ======================================================
   EMPTY
====================================================== */

function showEmpty() {

  if (!historyList) {
    return;
  }

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

  if (!date) {
    return "—";
  }

  const parsedDate =
    new Date(date);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {

    return "—";

  }

  return parsedDate.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );

}


/* ======================================================
   LOAD PURCHASE HISTORY
====================================================== */

async function loadPurchaseHistory() {

  try {

    showLoading();


    /* ==================================================
       CHECK LOGIN
    ================================================== */

    const user =
      auth.currentUser;


    if (!user) {

      showError(
        "You are not logged in."
      );

      return;

    }


    console.log(
      "📧 Loading purchase history for:",
      user.email
    );


    /* ==================================================
       GET FIREBASE TOKEN
    ================================================== */

    const token =
      await user.getIdToken(true);


    /* ==================================================
       API REQUEST
    ================================================== */

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


    /* ==================================================
       SERVER ERROR
    ================================================== */

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


    /* ==================================================
       JSON
    ================================================== */

    const data =
      await response.json();


    console.log(
      "Purchase history response:",
      data
    );


    /* ==================================================
       VALIDATE
    ================================================== */

    if (
      !data.success ||
      !Array.isArray(
        data.purchases
      )
    ) {

      throw new Error(
        "Invalid purchase history response"
      );

    }


    /* ==================================================
       EMPTY
    ================================================== */

    if (
      data.purchases.length === 0
    ) {

      showEmpty();

      return;

    }


    /* ==================================================
       RENDER
    ================================================== */

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

  if (!historyList) {
    return;
  }


  historyList.innerHTML = "";


  purchases.forEach(
    (purchase) => {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "purchase-row";


      /* ==================================================
         PRODUCT
      ================================================== */

      const product =
        escapeHtml(
          purchase.productTitle ||
          "PlagX Purchase"
        );


      /* ==================================================
         CREDITS
      ================================================== */

      const credits =
        purchase.credits ?? 0;


      /* ==================================================
         DATE
      ================================================== */

      const date =
        formatDate(
          purchase.createdAt
        );


      /* ==================================================
         ORDER ID
      ================================================== */

      const orderId =
        escapeHtml(
          purchase.paymentId ||
          "—"
        );


      /* ==================================================
         ROW
      ================================================== */

      row.innerHTML = `

        <!-- PRODUCT -->

        <div class="purchase-info">

          <strong>
            ${product}
          </strong>

        </div>


        <!-- CREDITS -->

        <div class="purchase-credits">

          +${credits}

        </div>


        <!-- DATE -->

        <div class="purchase-date">

          ${date}

        </div>


        <!-- ORDER ID -->

        <div class="purchase-order-id">

          ${orderId}

        </div>

      `;


      historyList.appendChild(
        row
      );

    }
  );

}


/* ======================================================
   HTML ESCAPE
====================================================== */

function escapeHtml(value) {

  return String(value)

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


/* ======================================================
   FIREBASE AUTH
====================================================== */

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) {

      console.log(
        "❌ No Firebase user"
      );

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
   GLOBAL FUNCTION
   Needed by onclick="loadPurchaseHistory()"
====================================================== */

window.loadPurchaseHistory =
  loadPurchaseHistory;


/* ======================================================
   CLOSE WINDOW
====================================================== */

/* ======================================================
   BACK TO DASHBOARD
====================================================== */

window.goBack = function () {
  window.location.replace("/dashboard.html");
};
