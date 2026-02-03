import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

/* ================= INIT ================= */
const auth = getAuth();
let firebaseToken = null;
let autoRefreshInterval = null;

/* ================= TOAST ================= */
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
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

/* Toast style */
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
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  opacity: 0;
  transition: opacity .4s ease;
  z-index: 99999;
}
`;
document.head.appendChild(toastStyle);

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

/* ================= AUTO REFRESH ================= */
async function startAutoRefresh() {
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);

  autoRefreshInterval = setInterval(async () => {
    const res = await fetch("/api/reports", {
      headers: { Authorization: `Bearer ${firebaseToken}` }
    });

    const reports = await res.json();

    // Check if any report is still processing
    const hasProcessing = reports.some(r =>
      (!r.aiReport?.storedName) || (!r.plagReport?.storedName)
    );

    if (!hasProcessing) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;

      loadUserReports();
      showToast("✅ Your report is ready!");
    }
  }, 3000);
}

/* ================= STATUS ================= */
async function checkPurchaseAndInit() {
  try {
    const res = await fetch("/api/user/status", {
      headers: { Authorization: `Bearer ${firebaseToken}` }
    });

    const data = await res.json();

    const credits = data.credits ?? 0;
    const expiresAt = data.expiresAt || null;
    const isExpired =
      expiresAt && new Date(expiresAt).getTime() < Date.now();

    document.getElementById("creditItem").textContent = `Credits: ${credits}`;
    document.getElementById("creditItemMobile").textContent = `Credits: ${credits}`;

    if (expiresAt) {
      document.getElementById("expiryDate").textContent =
        formatExpiry(expiresAt);
    }

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
      <input 
        type="file" 
        id="fileInput"
        accept=".pdf,.doc,.docx,.txt"
        required
      />
      <button class="upload-btn" type="submit">Upload →</button>
    </form>
  `;

  const fileInput = document.getElementById("fileInput");
  fileInput.addEventListener("change", function () {
    if (this.files.length > 1) {
      alert("Please upload only one file at a time.");
      this.value = "";
    }
  });

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
      headers: { Authorization: `Bearer ${firebaseToken}` },
      body: formData
    });

    loadUserReports();
    startAutoRefresh();
    showToast("⏳ Document uploaded... processing started");
  });
}

/* ================= REPORTS ================= */
async function loadUserReports() {
  try {
    const res = await fetch("/api/reports", {
      headers: { Authorization: `Bearer ${firebaseToken}` }
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
          : `<span class="processing">Processing...</span>`
      }
    </td>

    <td>
      ${
        order.plagReport?.storedName
          ? `<button class="view-btn"
              onclick="viewFile('${order.plagReport.storedName}')">
              View (${order.plagReport.percentage ?? 0}%)
            </button>`
          : `<span class="processing">Processing...</span>`
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
    headers: { Authorization: `Bearer ${firebaseToken}` }
  });

  loadUserReports();
};

window.openAccount = async () => {
  document.getElementById("accountPanel").classList.add("open");

  const res = await fetch("/api/account", {
    headers: { Authorization: `Bearer ${firebaseToken}` }
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
/* ================= HUMANIZER REDIRECT ================= */
window.openHumanizer = () => {
  window.location.href = "/humanize";
};

window.logout = async () => {
  await signOut(auth);
  window.location.href = "/login.html";
};
