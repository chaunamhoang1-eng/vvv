import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

/* ================= INIT ================= */
const auth = getAuth();
let currentUserEmail = null;
let autoRefreshInterval = null;

/* ================= AUTH CHECK ================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  currentUserEmail = user.email;
  checkPurchaseAndInit();
});

/* ================= PURCHASE CHECK ================= */
async function checkPurchaseAndInit() {
  try {
    const res = await fetch(`/api/user/status/${currentUserEmail}`);
    const data = await res.json();

    const credits = data.credits ?? 0;

    /* ===== SHOW CREDITS ===== */
    const desktopCredits = document.getElementById("creditItem");
    const mobileCredits = document.getElementById("creditItemMobile");

    if (desktopCredits) desktopCredits.textContent = `Credits: ${credits}`;
    if (mobileCredits) mobileCredits.textContent = `Credits: ${credits}`;

    /* ===== LOCK / UNLOCK (CREDITS ONLY) ===== */
    if (credits <= 0) {
      lockUploadOnly();
    } else {
      unlockUpload();
    }

    loadUserReports();

  } catch (err) {
    console.error("Purchase check failed", err);
  }
}

/* ================= UPLOAD LOCK ================= */
function lockUploadOnly() {
  const uploadSection = document.querySelector(".upload-section");
  if (!uploadSection) return;

  uploadSection.innerHTML = `
    <h2>Upload Locked 🔒</h2>
    <p>You need credits to upload documents.</p>
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
      <button class="upload-btn" type="submit">
        Upload →
      </button>
    </form>
  `;

  attachUploadHandler(); // ✅ VERY IMPORTANT
}

/* ================= ATTACH UPLOAD HANDLER ================= */
function attachUploadHandler() {
  const form = document.getElementById("uploadForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (!file) {
      alert("Please select a file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("email", currentUserEmail);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      alert("Upload failed");
      return;
    }

    fileInput.value = "";

    // 🔁 Refresh credits + UI after upload
    checkPurchaseAndInit();
  });
}

/* ================= LOAD REPORTS ================= */
async function loadUserReports() {
  try {
    const res = await fetch(`/api/reports/${currentUserEmail}`);
    const reports = await res.json();

    const table = document.getElementById("reportTable");
    table.innerHTML = "";

    if (!reports.length) {
      table.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;">🚀 No reports available</td>
        </tr>
      `;
      return;
    }

    let hasPending = false;

    reports.forEach(order => {
      if (!order.aiReport?.storedName || !order.plagReport?.storedName) {
        hasPending = true;
      }
      addReportRow(order);
    });

    if (hasPending && !autoRefreshInterval) {
      autoRefreshInterval = setInterval(loadUserReports, 10000);
    }

    if (!hasPending && autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }

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

    <td>
      ${
        order.aiReport?.storedName
          ? `<button class="view-btn" onclick="viewFile('${order.aiReport.storedName}')">
              View (${order.aiReport.percentage ?? 0}%)
            </button>`
          : `<span class="processing">Processing</span>`
      }
    </td>

    <td>
      ${
        order.plagReport?.storedName
          ? `<button class="view-btn" onclick="viewFile('${order.plagReport.storedName}')">
              View (${order.plagReport.percentage ?? 0}%)
            </button>`
          : `<span class="processing">Processing</span>`
      }
    </td>

    <td>${new Date(order.createdAt).toLocaleDateString()}</td>

    <td>
      <button class="delete-btn" onclick="deleteReport('${order._id}')">
        Delete
      </button>
    </td>
  `;

  table.appendChild(row);
}

/* ================= DELETE ================= */
window.deleteReport = async (orderId) => {
  if (!confirm("Delete this report?")) return;
  await fetch(`/api/delete/${orderId}`, { method: "DELETE" });
  loadUserReports();
};

/* ================= ACCOUNT ================= */
window.openAccount = async () => {
  const panel = document.getElementById("accountPanel");
  panel.classList.add("open");

  const res = await fetch(`/api/account/${currentUserEmail}`);
  const data = await res.json();

  document.getElementById("accEmail").textContent = data.email || "—";
  document.getElementById("accCredits").textContent = data.credits ?? 0;
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
