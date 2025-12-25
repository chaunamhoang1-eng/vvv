import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

/* ================= INIT ================= */
const auth = getAuth();
let currentUserEmail = null;

/* ================= AUTH CHECK ================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  currentUserEmail = user.email;
  loadUserReports(); // load reports on login
});

/* ================= LOAD REPORTS ================= */
async function loadUserReports() {
  try {
    const res = await fetch(`/api/reports/${currentUserEmail}`);
    const reports = await res.json();

    const table = document.getElementById("reportTable");
    table.innerHTML = "";

    reports.forEach(addReportRow);
  } catch (err) {
    console.error("Failed to load reports:", err);
  }
}

/* ================= FILE UPLOAD ================= */
document.getElementById("uploadForm").addEventListener("submit", async (e) => {
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

  await loadUserReports(); // refresh table
  fileInput.value = "";
});

/* ================= ADD TABLE ROW ================= */
function addReportRow(order) {
  const table = document.getElementById("reportTable");
  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${order.filename || "—"}</td>

    <!-- AI COLUMN -->
    <td>
      ${
        order.aiReport && order.aiReport.storedName
          ? `<a href="/uploads/${order.aiReport.storedName}" target="_blank">View AI</a>`
          : `<span style="color:red">AI Pending</span>`
      }
    </td>

    <!-- PLAG COLUMN -->
    <td>
      ${
        order.plagReport && order.plagReport.storedName
          ? `<a href="/uploads/${order.plagReport.storedName}" target="_blank">View Plag</a>`
          : `<span style="color:red">Plag Pending</span>`
      }
    </td>

    <td>${new Date(order.createdAt).toLocaleDateString()}</td>

    <!-- ACTIONS: DELETE ONLY -->
    <td>
      <button
        onclick="deleteReport('${order.storedName}')"
        style="
          background:#ff4d4d;
          color:#fff;
          border:none;
          padding:6px 10px;
          border-radius:6px;
          cursor:pointer;
        ">
        Delete
      </button>
    </td>
  `;

  table.appendChild(row);
}


/* ================= DELETE REPORT ================= */
window.deleteReport = async (storedName) => {
  const confirmDelete = confirm("Are you sure you want to delete this file?");
  if (!confirmDelete) return;

  const res = await fetch(`/api/delete/${storedName}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    alert("Failed to delete file");
    return;
  }

  alert("File deleted successfully");
  loadUserReports(); // refresh table
};

/* ================= LOGOUT ================= */
window.logout = async () => {
  await signOut(auth);
  window.location.href = "/login.html";
};
