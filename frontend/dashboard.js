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

    const creditItem = document.getElementById("creditItem");
    if (creditItem) {
      creditItem.textContent = `Credits: ${data.credits ?? 0}`;
    }

    if (!data.hasPurchased || data.credits <= 0) {
      lockDashboard();
    } else {
      loadUserReports();
    }
  } catch (err) {
    console.error("Purchase check failed", err);
  }
}

/* ================= LOCK DASHBOARD ================= */
function lockDashboard() {
  document.querySelector(".upload-section").innerHTML = `
    <h2>Upload Locked 🔒</h2>
    <p>You need to purchase a plan to upload documents.</p>
    <button class="upload-btn" onclick="redirectToPurchase()">
      Purchase Plan →
    </button>
  `;

  document.getElementById("reportTable").innerHTML = `
    <tr>
      <td colspan="5" style="text-align:center;font-weight:600;">
        🚀 No reports available <br /><br />
        <button class="upload-btn" onclick="redirectToPurchase()">
          Purchase a Plan
        </button>
      </td>
    </tr>
  `;
}

/* ================= LOAD REPORTS + AUTO REFRESH ================= */
async function loadUserReports() {
  try {
    const res = await fetch(`/api/reports/${currentUserEmail}`);
    const reports = await res.json();

    const table = document.getElementById("reportTable");
    table.innerHTML = "";

    let hasPending = false;

    reports.forEach(order => {
      if (!order.aiReport?.storedName || !order.plagReport?.storedName) {
        hasPending = true;
      }
      addReportRow(order);
    });

    // 🔄 Auto refresh while processing
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

/* ================= UPLOAD ================= */
document.getElementById("uploadForm")?.addEventListener("submit", async (e) => {
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
    alert("Upload failed or purchase required");
    redirectToPurchase();
    return;
  }

  fileInput.value = "";
  loadUserReports();
});

/* ================= VIEW FILE ================= */
window.viewFile = function (url) {
  if (!url) {
    alert("File not available");
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
};


/* ================= TABLE ROW ================= */
function addReportRow(order) {
  const table = document.getElementById("reportTable");
  const row = document.createElement("tr");

  row.innerHTML = `
    <td data-label="Document">${order.filename}</td>

    <td data-label="AI">
      ${
        order.aiReport?.storedName
          ? `<button class="view-btn"
              onclick="viewFile('${order.aiReport.storedName}')">
              View (${order.aiReport.percentage ?? 0}%)
            </button>`
          : `<span class="processing">Processing</span>`
      }
    </td>

    <td data-label="Plagiarism">
      ${
        order.plagReport?.storedName
          ? `<button class="view-btn"
              onclick="viewFile('${order.plagReport.storedName}')">
              View (${order.plagReport.percentage ?? 0}%)
            </button>`
          : `<span class="processing">Processing</span>`
      }
    </td>

    <td data-label="Date">
      ${new Date(order.createdAt).toLocaleDateString()}
    </td>

    <td data-label="Actions">
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

window.deleteAccount = async () => {
  if (!confirm("This will permanently delete your account.")) return;
  await fetch(`/api/account/${currentUserEmail}`, { method: "DELETE" });
  await signOut(auth);
  window.location.href = "/signup.html";
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
