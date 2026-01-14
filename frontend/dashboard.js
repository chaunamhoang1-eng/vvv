import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

/* ================= FIREBASE INIT (REQUIRED) ================= */
const firebaseConfig = {
  apiKey: "AIzaSyAbvVgUW6H3sJBY3Sng7JSCzyBFN1PxrnQ",
  authDomain: "login-98c26.firebaseapp.com",
  projectId: "login-98c26",
  storageBucket: "login-98c26.firebasestorage.app",
  messagingSenderId: "199892612420",
  appId: "1:199892612420:web:db0aeb5bd145f335955311"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

/* ================= GLOBAL STATE ================= */
let firebaseToken = null;

/* ================= AUTH CHECK ================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

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
    const isExpired =
      data.expiresAt && new Date(data.expiresAt) < new Date();

    document.getElementById("creditItem").textContent = `Credits: ${credits}`;
    const mobile = document.getElementById("creditItemMobile");
    if (mobile) mobile.textContent = `Credits: ${credits}`;

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

/* ================= UPLOAD LOCK ================= */
function lockUploadOnly(isExpired) {
  document.querySelector(".upload-section").innerHTML = `
    <h2>Upload Locked 🔒</h2>
    <p>${isExpired ? "Your plan expired." : "You need credits."}</p>
    <button class="upload-btn" onclick="redirectToPurchase()">
      Purchase Plan →
    </button>
  `;
}

/* ================= UPLOAD UNLOCK ================= */
function unlockUpload() {
  document.querySelector(".upload-section").innerHTML = `
    <h2>Upload Document</h2>
    <form id="uploadForm">
      <input type="file" id="fileInput" required />
      <button class="upload-btn" type="submit">Upload →</button>
    </form>
  `;
  attachUploadHandler();
}

/* ================= UPLOAD ================= */
function attachUploadHandler() {
  document.getElementById("uploadForm").onsubmit = async (e) => {
    e.preventDefault();
    const file = document.getElementById("fileInput").files[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);

    await fetch("/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${firebaseToken}` },
      body: fd
    });

    checkPurchaseAndInit();
  };
}

/* ================= REPORTS ================= */
async function loadUserReports() {
  const res = await fetch("/api/reports", {
    headers: { Authorization: `Bearer ${firebaseToken}` }
  });

  const reports = await res.json();
  const table = document.getElementById("reportTable");
  table.innerHTML = "";

  if (!reports.length) {
    table.innerHTML = `<tr><td colspan="5">🚀 No reports</td></tr>`;
    return;
  }

  reports.forEach(order => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${order.filename}</td>
      <td>${order.aiReport?.storedName ? "✅" : "⏳"}</td>
      <td>${order.plagReport?.storedName ? "✅" : "⏳"}</td>
      <td>${new Date(order.createdAt).toLocaleDateString()}</td>
      <td><button onclick="deleteReport('${order._id}')">Delete</button></td>
    `;
    table.appendChild(row);
  });
}

/* ================= DELETE REPORT ================= */
window.deleteReport = async (id) => {
  await fetch(`/api/delete/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${firebaseToken}` }
  });
  loadUserReports();
};

/* ================= ACCOUNT ================= */
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

/* ================= REDIRECT ================= */
window.redirectToPurchase = () => {
  window.location.href = "https://scanai.sell.app/";
};

/* ================= LOGOUT (FIXED) ================= */
window.logout = async () => {
  await signOut(auth);
  window.location.href = "/login.html";
};
