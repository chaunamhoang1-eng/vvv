import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

/* ================= INIT ================= */
const auth = getAuth();
let firebaseToken = null;
let autoRefreshInterval = null;

/* ================= HELPERS ================= */
function formatExpiry(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getDaysLeft(expiryDate) {
  const diff = new Date(expiryDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/* ================= AUTH ================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  firebaseToken = await user.getIdToken(true);
  checkPurchaseAndInit();
});

/* ================= STATUS ================= */
async function checkPurchaseAndInit() {
  try {
    const res = await fetch("/api/user/status", {
      headers: {
        Authorization: `Bearer ${firebaseToken}`
      }
    });

    const data = await res.json();

    const credits = data.credits ?? 0;
    const expiresAt = data.expiresAt || null;
    const isExpired =
      expiresAt && new Date(expiresAt).getTime() < Date.now();
    const daysLeft = expiresAt ? getDaysLeft(expiresAt) : null;

    /* ===== CREDITS ===== */
    document.getElementById("creditItem").textContent = `Credits: ${credits}`;
    document.getElementById("creditItemMobile").textContent = `Credits: ${credits}`;

    /* ===== EXPIRY ===== */
    if (expiresAt) {
      document.getElementById("expiryDate").textContent =
        formatExpiry(expiresAt);
    }

    /* ===== UPLOAD LOCK ===== */
    if (credits <= 0 || isExpired) {
      lockUploadOnly(isExpired);
    } else {
      unlockUpload();
    }

    loadUserReports();

  } catch (err) {
    console.error("Status check failed:", err);
  }
}

/* ================= UPLOAD ================= */
function lockUploadOnly(isExpired) {
  document.querySelector(".upload-section").innerHTML = `
    <h2>Upload Locked 🔒</h2>
    <p>${isExpired
      ? "Your plan has expired."
      : "You need credits to upload documents."}</p>
    <button class="upload-btn" onclick="redirectToPurchase()">
      Purchase Plan →
    </button>
  `;
}

function unlockUpload() {
  document.querySelector(".upload-section").innerHTML = `
    <h2>Upload Document</h2>
    <p>Supported: PDF, DOCX, TXT</p>
    <form id="uploadForm">
      <input type="file" id="fileInput" required />
      <button class="upload-btn" type="submit">Upload →</button>
    </form>
  `;
  attachUploadHandler();
}

function attachUploadHandler() {
  document.getElementById("uploadForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const file = document.getElementById("fileInput").files[0];
    if (!file) return alert("Select a file");

    const formData = new FormData();
    formData.append("file", file);

    await fetch("/api/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firebaseToken}`
      },
      body: formData
    });

    checkPurchaseAndInit();
  });
}

/* ================= REPORTS ================= */
async function loadUserReports() {
  try {
    const res = await fetch("/api/reports", {
      headers: {
        Authorization: `Bearer ${firebaseToken}`
      }
    });

    const reports = await res.json();
    const table = document.getElementById("reportTable");
    table.innerHTML = "";

    if (!reports.length) {
      table.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;">🚀 No reports available</td>
        </tr>`;
      return;
    }

    reports.forEach(addReportRow);

  } catch (err) {
    console.error("Load reports failed:", err);
  }
}

/* ================= TABLE ROW ================= */
function addReportRow(order) {
  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${order.filename}</td>

    <td>
      ${
        order.aiReport?.storedName
          ? `<button class="view-btn"
              onclick="viewFile('${order.aiReport.storedName}')">
              View (${order.aiReport.percentage ?? 0}%)
            </button>`
          : `<span class="processing">Processing</span>`
      }
    </td>

    <td>
      ${
        order.plagReport?.storedName
          ? `<button class="view-btn"
              onclick="viewFile('${order.plagReport.storedName}')">
              View (${order.plagReport.percentage ?? 0}%)
            </button>`
          : `<span class="processing">Processing</span>`
      }
    </td>

    <td>${new Date(order.createdAt).toLocaleDateString("en-IN")}</td>

    <td>
      <button class="delete-btn"
        onclick="deleteReport('${order._id}')">
        Delete
      </button>
    </td>
  `;

  document.getElementById("reportTable").appendChild(row);
}

/* ================= ACTIONS ================= */
window.viewFile = (url) => {
  window.open(url, "_blank", "noopener,noreferrer");
};

window.deleteReport = async (id) => {
  if (!confirm("Delete this report?")) return;

  await fetch(`/api/delete/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${firebaseToken}`
    }
  });

  loadUserReports();
};

window.openAccount = async () => {
  document.getElementById("accountPanel").classList.add("open");

  const res = await fetch("/api/account", {
    headers: {
      Authorization: `Bearer ${firebaseToken}`
    }
  });

  const data = await res.json();
  document.getElementById("accEmail").textContent =
    data.email || auth.currentUser.email;
  document.getElementById("accCredits").textContent = data.credits ?? 0;
};

window.closeAccount = () => {
  document.getElementById("accountPanel").classList.remove("open");
};

window.redirectToPurchase = () => {
  window.location.href = "https://scanai.sell.app/";
};

window.logout = async () => {
  await signOut(auth);
  window.location.href = "/login.html";
};
