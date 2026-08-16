import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";


/* ======================================================
   FIREBASE AUTH
====================================================== */

const auth = getAuth();

let firebaseToken = null;


/* ======================================================
   HTML ESCAPE
====================================================== */

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/* ======================================================
   DATE FORMAT
====================================================== */

function formatDate(dateValue) {

  if (!dateValue) {
    return "—";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );

}


/* ======================================================
   AMOUNT FORMAT
====================================================== */

function formatAmount(amount, currency) {

  if (
    amount === null ||
    amount === undefined ||
    amount === ""
  ) {
    return "—";
  }

  return `${currency || "USD"} ${amount}`;

}


/* ======================================================
   AUTH STATE
====================================================== */

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) {

      window.location.href =
        "/login.html";

      return;

    }

    try {

      firebaseToken =
        await user.getIdToken(true);

      await loadPurchaseHistory();

    } catch (error) {

      console.error(
        "Firebase authentication error:",
        error
      );

      showError();

    }

  }
);


/* ======================================================
   LOAD PURCHASE HISTORY
====================================================== */

async function loadPurchaseHistory() {

  const container =
    document.getElementById(
      "purchaseHistoryList"
    );

  if (!container) {
    console.error(
      "purchaseHistoryList element not found"
    );
    return;
  }


  container.innerHTML = `

    <div class="purchase-loading">

      Loading purchase history...

    </div>

  `;


  try {

    const response =
      await fetch(
        "/api/purchase-history",
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${firebaseToken}`
          }
        }
      );


    console.log(
      "Purchase history status:",
      response.status
    );


    if (response.status === 401) {

      window.location.href =
        "/login.html";

      return;

    }


    if (!response.ok) {

      throw new Error(
        `Server returned ${response.status}`
      );

    }


    const data =
      await response.json();


    console.log(
      "Purchase history:",
      data
    );


    if (!data.success) {

      throw new Error(
        data.error ||
        "Failed to load purchase history"
      );

    }


    const purchases =
      Array.isArray(data.purchases)
        ? data.purchases
        : [];


    /* ==================================================
       NO PURCHASES
    ================================================== */

    if (purchases.length === 0) {

      container.innerHTML = `

        <div class="no-purchases">

          <div style="font-size:42px;">
            🛒
          </div>

          <h3>
            No purchases yet
          </h3>

          <p>
            Your previous PlagX purchases
            will appear here.
          </p>

        </div>

      `;

      return;

    }


    /* ==================================================
       PURCHASE LIST
    ================================================== */

    container.innerHTML =
      purchases
        .map(
          (purchase) => {

            const productTitle =
              escapeHtml(
                purchase.productTitle ||
                "PlagX Purchase"
              );


            const credits =
              Number(
                purchase.credits || 0
              );


            const amount =
              escapeHtml(
                formatAmount(
                  purchase.amount,
                  purchase.currency
                )
              );


            const paymentId =
              escapeHtml(
                purchase.paymentId || ""
              );


            const date =
              formatDate(
                purchase.createdAt
              );


            return `

              <div class="purchase-row">


                <!-- PRODUCT -->

                <div class="purchase-info">

                  <strong>
                    ${productTitle}
                  </strong>

                  <small>
                    Purchased on ${date}
                  </small>

                  ${
                    paymentId
                      ? `
                        <small>
                          Payment ID:
                          ${paymentId}
                        </small>
                      `
                      : ""
                  }

                </div>


                <!-- CREDITS -->

                <div class="purchase-credits">

                  <strong>
                    +${credits}
                  </strong>

                  <span>
                    Credits
                  </span>

                </div>


                <!-- AMOUNT -->

                <div class="purchase-amount">

                  ${amount}

                </div>


                <!-- STATUS -->

                <div class="purchase-status">

                  ✓ Completed

                </div>


              </div>

            `;

          }
        )
        .join("");


  } catch (error) {

    console.error(
      "Purchase history error:",
      error
    );

    showError();

  }

}


/* ======================================================
   ERROR
====================================================== */

function showError() {

  const container =
    document.getElementById(
      "purchaseHistoryList"
    );

  if (!container) {
    return;
  }


  container.innerHTML = `

    <div class="purchase-error">

      <div style="font-size:32px;">
        ❌
      </div>

      <h3>
        Unable to load purchase history
      </h3>

      <p>
        Please try again.
      </p>

      <button
        class="retry-history-btn"
        onclick="loadPurchaseHistory()">

        ↻ Try Again

      </button>

    </div>

  `;

}


/* ======================================================
   MAKE FUNCTION AVAILABLE TO HTML
====================================================== */

window.loadPurchaseHistory =
  loadPurchaseHistory;
