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

function showExpiryWarning(daysLeft, isExpired) {
  const box = document.getElementById("queueStatusBox");
  if (!box) return;

  if (isExpired) {
    box.style.display = "block";
    box.style.background = "#3b1d1d";
    box.style.borderLeft = "4px solid #ff5c5c";
    box.style.color = "#ffb4b4";
    box.innerText =
      "❌ Your plan has expired. Please renew to continue uploading.";
    return;
  }

  if (daysLeft <= 7 && daysLeft > 0) {
    box.style.display = "block";
    box.style.background = "#3b331d";
    box.style.borderLeft = "4px solid #ffcc00";
    box.style.color = "#ffe08a";
    box.innerText =
      `⚠️ Your plan expires in ${daysLeft} day${daysLeft > 1 ? "s" : ""}.`;
    return;
  }

  box.style.display = "none";
}

/* ================= AUTH CHECK ================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  // 🔐 always get fresh token
  firebaseToken = await user.getIdToken(true);
  await checkPurchaseAndInit();
});

/* ================= STATUS CHECK ================= */
async function checkPurchaseAndInit() {
  try {
    const res = await fetch("/api/user/status", {
      headers: {
        Authorization: `Bearer ${firebaseToken}`
      }
    });

    if (!res.ok) throw new Error("Unauthorized");

    const data = await res.json();

    const credits = data.credits ?? 0;
    const expiresAt = data.expiresAt || null;
    const isExpired =
      expiresAt && new Date(expiresAt).getTime() < Date.now();
    const daysLeft = expiresAt ? getDaysLeft(expiresAt) : null;

    /* ===== SHOW CREDITS ===== */
    const desktopCredits = document.getElementById("creditItem");
    const mobileCredits = document.getElementById("creditItemMobile");

    if (desktopCredits) desktopCredits.textContent = `Credits: ${credits}`;
    if (mobileCredits) mobileCredits.textContent = `Credits: ${credits}`;

    /* ===== WARNING ===== */
    if (expiresAt) showExpiryWarning(daysLeft, isExpired);

    /* ===== LOCK / UNLOCK ===== */
    if (credits <= 0 || isExpired) {
      lockUploadOnly(isExpired);
    } else {
      unlockUpload();
    }

    loadUserReports();

  } catch (err) {
    console.error("Status check failed:", err.message);
  }
}

/* ================= UPLOAD LOCK ================= */
function lockUploadOnly(isExpired = false) {
  const uploadSection = document.querySelector(".upload-section");
  if (!uploadSection) return;

  uploadSection.innerHTML = `
    <h2>Upload Locked 🔒</h2>
    <p>
      ${
        isExpired
          ? "Your plan has expired. Please renew to upload documents."
          : "You need credits to upload documents."
      }
    </p>
    <button class="upload-btn" onclick="redirectToPurchase()">
      Purchase Plan →
    </button>
  `;
}

/* ================= UPLOAD UNLOCK ================= */
function unlockUpload() {
  const uploadSection = document.querySelector(".upload-section");
  if (!uploadSection) return;

  uploadSection.innerHTML = `
    <h2>Upload Document</h2>
    <p>Supported: PDF, DOCX, TXT</p>

    <form id="uploadForm">
      <input type="file" id="fileInput" required />
      <button class="upload-btn" type="submit">Upload →</button>
    </form>
  `;

  attachUploadHandler();
}

/* ================= UPLOAD ================= */
function attachUploadHandler() {
  const form = document.getElementById("uploadForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const file = document.getElementById("fileInput").files[0];
    if (!file) return alert("Please select a file");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firebaseToken}`
      },
      body: formData
    });

    if (!res.ok) {
      alert("Upload failed");
      return;
    }

    checkPurchaseAndInit();
  });
}

/* ================= LOAD REPORTS ================= */
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
          <td colspan="5" style="text-align:center;">
            🚀 No reports available
          </td>
        </tr>
      `;
      return;
    }

    reports.forEach(addReportRow);

  } catch (err) {
    console.error("Failed to load reports:", err);
  }
}

/* ================= VIEW FILE ================= */
window.viewFile = (url) => {
  if (!url) return alert("File not available");
  window.open(url, "_blank", "noopener,noreferrer");
};

/* ================= TABLE ROW ================= */
function addReportRow(order) {
  const table = document.getElementById("reportTable");
  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${order.filename}</td>
    <td>${order.aiReport?.storedName ? "✅" : "⏳"}</td>
    <td>${order.plagReport?.storedName ? "✅" : "⏳"}</td>
    <td>${new Date(order.createdAt).toLocaleDateString("en-IN")}</td>
    <td>
      <button class="delete-btn" onclick="deleteReport('${order._id}')">
        Delete
      </button>
    </td>
  `;

  table.appendChild(row);
}

/* ================= DELETE REPORT ================= */
window.deleteReport = async (orderId) => {
  if (!confirm("Delete this report?")) return;

  await fetch(`/api/delete/${orderId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${firebaseToken}`
    }
  });

  loadUserReports();
};

/* ================= ACCOUNT ================= */
window.openAccount = async () => {
  const panel = document.getElementById("accountPanel");
  panel.classList.add("open");

  const res = await fetch("/api/account", {
    headers: {
      Authorization: `Bearer ${firebaseToken}`
    }
  });

  const data = await res.json();

  document.getElementById("accEmail").textContent =
    data.email || auth.currentUser?.email || "—";

  document.getElementById("accCredits").textContent =
    data.credits ?? 0;
};

window.closeAccount = () => {
  document.getElementById("accountPanel").classList.remove("open");
};

/* ================= REDIRECT ================= */
window.redirectToPurchase = () => {
  window.location.href = "https://scanai.sell.app/";
};

/* ================= LOGOUT ================= */
window.logout = async () => {
  await signOut(auth);
  window.location.href = "/login.html";
};
