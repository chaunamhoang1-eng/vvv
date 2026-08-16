import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";


/* ======================================================
   INIT
====================================================== */

const auth = getAuth();

let firebaseToken = null;
let autoRefreshInterval = null;


/* ======================================================
   TOAST
====================================================== */

function showToast(msg) {

  const toast = document.createElement("div");

  toast.className = "toast-message";
  toast.textContent = msg;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "1";
  }, 100);

  setTimeout(() => {

    toast.style.opacity = "0";

    setTimeout(
      () => toast.remove(),
      500
    );

  }, 3000);

}


/* ======================================================
   TOAST STYLE
====================================================== */

const toastStyle = document.createElement("style");

toastStyle.innerHTML = `

.toast-message {

  position: fixed;

  bottom: 25px;

  right: 25px;

  background: #4b8df8;

  color: white;

  padding: 12px 18px;

  border-radius: 8px;

  font-size: 15px;

  box-shadow:
    0 4px 12px
    rgba(0,0,0,0.2);

  opacity: 0;

  transition:
    opacity .4s ease;

  z-index: 99999;

}

`;

document.head.appendChild(toastStyle);


/* ======================================================
   HELPERS
====================================================== */

function formatExpiry(dateStr) {

  return new Date(dateStr).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );

}


function getDaysLeft(expiryDate) {

  const diff =
    new Date(expiryDate).getTime()
    - Date.now();

  return Math.ceil(
    diff / (1000 * 60 * 60 * 24)
  );

}


/* ======================================================
   HTML SECURITY HELPER
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
   AUTH
====================================================== */

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) {

      window.location.href = "/login.html";

      return;

    }

    try {

      firebaseToken =
        await user.getIdToken(true);

      await checkPurchaseAndInit();

    } catch (err) {

      console.error(
        "Dashboard initialization failed:",
        err
      );

    }

  }
);


/* ======================================================
   AUTO REFRESH
====================================================== */

async function startAutoRefresh() {

  if (autoRefreshInterval) {

    clearInterval(
      autoRefreshInterval
    );

  }

  autoRefreshInterval =
    setInterval(
      async () => {

        try {

          const res =
            await fetch(
              "/api/reports",
              {
                headers: {
                  Authorization:
                    `Bearer ${firebaseToken}`
                }
              }
            );


          if (!res.ok) {
            return;
          }


          const reports =
            await res.json();


          const hasProcessing =
            reports.some(
              r =>
                (!r.aiReport?.storedName) ||
                (!r.plagReport?.storedName)
            );


          if (!hasProcessing) {

            clearInterval(
              autoRefreshInterval
            );

            autoRefreshInterval = null;

            loadUserReports();

            showToast(
              "✅ Your report is ready!"
            );

          }

        } catch (err) {

          console.error(
            "Auto refresh failed:",
            err
          );

        }

      },
      3000
    );

}


/* ======================================================
   STATUS
====================================================== */

async function checkPurchaseAndInit() {

  try {

    const res =
      await fetch(
        "/api/user/status",
        {
          headers: {
            Authorization:
              `Bearer ${firebaseToken}`
          }
        }
      );


    if (!res.ok) {

      throw new Error(
        "Status request failed"
      );

    }


    const data =
      await res.json();


    const credits =
      data.credits ?? 0;


    const expiresAt =
      data.expiresAt || null;


    const isExpired =
      expiresAt &&
      new Date(expiresAt).getTime()
      < Date.now();


    const creditItem =
      document.getElementById(
        "creditItem"
      );


    const creditItemMobile =
      document.getElementById(
        "creditItemMobile"
      );


    if (creditItem) {

      creditItem.textContent =
        `Credits: ${credits}`;

    }


    if (creditItemMobile) {

      creditItemMobile.textContent =
        `Credits: ${credits}`;

    }


    if (expiresAt) {

      const expiryDate =
        document.getElementById(
          "expiryDate"
        );


      if (expiryDate) {

        expiryDate.textContent =
          formatExpiry(expiresAt);

      }

    }


    if (
      credits <= 0 ||
      isExpired
    ) {

      lockUploadOnly(
        isExpired
      );

    } else {

      unlockUpload();

    }


    loadUserReports();

  } catch (err) {

    console.error(
      "Status check failed:",
      err
    );

  }

}


/* ======================================================
   UPLOAD LOCK
====================================================== */

function lockUploadOnly(isExpired) {

  const section =
    document.querySelector(
      ".upload-section"
    );


  if (!section) {
    return;
  }


  section.innerHTML = `

    <h2>
      Upload Locked 🔒
    </h2>

    <p>
      ${
        isExpired
          ? "Your plan has expired."
          : "You need credits to upload documents."
      }
    </p>

    <button
      class="upload-btn"
      onclick="redirectToPurchase()">

      Purchase Plan →

    </button>

  `;

}


/* ======================================================
   UNLOCK UPLOAD
====================================================== */

function unlockUpload() {

  const section =
    document.querySelector(
      ".upload-section"
    );


  if (!section) {
    return;
  }


  section.innerHTML = `

    <h2>
      Upload Document
    </h2>

    <p>
      Supported: PDF, DOCX, TXT
    </p>

    <form id="uploadForm">

      <input
        type="file"
        id="fileInput"
        accept=".pdf,.doc,.docx,.txt"
        required
      />

      <button
        class="upload-btn"
        type="submit">

        Upload →

      </button>

    </form>

  `;


  const fileInput =
    document.getElementById(
      "fileInput"
    );


  if (fileInput) {

    fileInput.addEventListener(
      "change",
      function () {

        if (this.files.length > 1) {

          alert(
            "Please upload only one file at a time."
          );

          this.value = "";

        }

      }
    );

  }


  attachUploadHandler();

}


/* ======================================================
   UPLOAD HANDLER
====================================================== */

function attachUploadHandler() {

  const form =
    document.getElementById(
      "uploadForm"
    );


  if (!form) {
    return;
  }


  form.addEventListener(
    "submit",
    async (e) => {

      e.preventDefault();


      const fileInput =
        document.getElementById(
          "fileInput"
        );


      const file =
        fileInput?.files?.[0];


      if (!file) {

        alert(
          "Select a file"
        );

        return;

      }


      try {

        const formData =
          new FormData();


        formData.append(
          "file",
          file
        );


        const res =
          await fetch(
            "/api/upload",
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${firebaseToken}`
              },

              body: formData
            }
          );


        if (!res.ok) {

          throw new Error(
            "Upload failed"
          );

        }


        loadUserReports();

        startAutoRefresh();

        showToast(
          "⏳ Document uploaded... processing started"
        );


      } catch (err) {

        console.error(
          "Upload failed:",
          err
        );

        showToast(
          "❌ Upload failed"
        );

      }

    }
  );

}


/* ======================================================
   REPORTS
====================================================== */

async function loadUserReports() {

  try {

    const res =
      await fetch(
        "/api/reports",
        {
          headers: {
            Authorization:
              `Bearer ${firebaseToken}`
          }
        }
      );


    if (!res.ok) {

      throw new Error(
        "Failed to load reports"
      );

    }


    const reports =
      await res.json();


    const table =
      document.getElementById(
        "reportTable"
      );


    if (!table) {
      return;
    }


    table.innerHTML = "";


    if (!reports.length) {

      table.innerHTML = `

        <tr>

          <td
            colspan="5"
            style="text-align:center;">

            🚀 No reports available

          </td>

        </tr>

      `;

      return;

    }


    reports.forEach(
      addReportRow
    );


  } catch (err) {

    console.error(
      "Load reports failed:",
      err
    );

  }

}


/* ======================================================
   REPORT ROW
====================================================== */

function addReportRow(order) {

  const row =
    document.createElement("tr");


  row.innerHTML = `

    <td>
      ${escapeHtml(order.filename)}
    </td>


    <td>

      ${
        order.aiReport?.storedName

          ? `

            <button
              class="view-btn"
              onclick="viewFile('${escapeHtml(
                order.aiReport.storedName
              )}')">

              View

            </button>

          `

          : `

            <span class="processing">
              Processing...
            </span>

          `
      }

    </td>


    <td>

      ${
        order.plagReport?.storedName

          ? `

            <button
              class="view-btn"
              onclick="viewFile('${escapeHtml(
                order.plagReport.storedName
              )}')">

              View

            </button>

          `

          : `

            <span class="processing">
              Processing...
            </span>

          `
      }

    </td>


    <td>
      ${new Date(
        order.createdAt
      ).toLocaleDateString("en-IN")}
    </td>


    <td>

      <button
        class="delete-btn"
        onclick="deleteReport('${escapeHtml(
          order._id
        )}')">

        Delete

      </button>

    </td>

  `;


  const table =
    document.getElementById(
      "reportTable"
    );


  if (table) {

    table.appendChild(row);

  }

}


/* ======================================================
   OPEN PURCHASE HISTORY
====================================================== */

window.openPurchaseHistory = () => {

  window.open(
    "/purchase-history.html",
    "_blank"
  );

};


/* ======================================================
   ACTIONS
====================================================== */

window.viewFile = (url) => {

  window.open(
    url,
    "_blank",
    "noopener,noreferrer"
  );

};


window.deleteReport =
  async (id) => {

    if (
      !confirm(
        "Delete this report?"
      )
    ) {

      return;

    }


    try {

      const res =
        await fetch(
          `/api/delete/${id}`,
          {
            method: "DELETE",

            headers: {
              Authorization:
                `Bearer ${firebaseToken}`
            }
          }
        );


      if (!res.ok) {

        throw new Error(
          "Delete failed"
        );

      }


      loadUserReports();

      showToast(
        "Report deleted"
      );


    } catch (err) {

      console.error(
        "Delete report failed:",
        err
      );

      showToast(
        "❌ Failed to delete report"
      );

    }

  };


/* ======================================================
   ACCOUNT
====================================================== */

window.openAccount =
  async () => {

    const panel =
      document.getElementById(
        "accountPanel"
      );


    if (!panel) {
      return;
    }


    panel.classList.add(
      "open"
    );


    try {

      const res =
        await fetch(
          "/api/account",
          {
            headers: {
              Authorization:
                `Bearer ${firebaseToken}`
            }
          }
        );


      if (!res.ok) {

        throw new Error(
          "Account request failed"
        );

      }


      const data =
        await res.json();


      const emailElement =
        document.getElementById(
          "accEmail"
        );


      const creditsElement =
        document.getElementById(
          "accCredits"
        );


      if (emailElement) {

        emailElement.textContent =
          data.email ||
          auth.currentUser?.email ||
          "—";

      }


      if (creditsElement) {

        creditsElement.textContent =
          data.credits ?? 0;

      }


    } catch (err) {

      console.error(
        "Account loading failed:",
        err
      );

    }

  };


window.closeAccount = () => {

  document
    .getElementById(
      "accountPanel"
    )
    ?.classList.remove(
      "open"
    );

};


/* ======================================================
   PURCHASE REDIRECT
====================================================== */

window.redirectToPurchase = () => {

  window.location.href =
    "https://scanai.sell.app/";

};


/* ======================================================
   HUMANIZER
====================================================== */

window.openHumanizer = () => {

  window.location.href =
    "/humanize";

};


/* ======================================================
   LOGOUT
====================================================== */

window.logout =
  async () => {

    try {

      await signOut(
        auth
      );


      window.location.href =
        "/login.html";


    } catch (err) {

      console.error(
        "Logout failed:",
        err
      );

    }

  };
