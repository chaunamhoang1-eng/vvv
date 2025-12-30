/* ================= JWT FETCH HELPER ================= */
function adminFetch(url, options = {}) {
  const token = localStorage.getItem("adminToken");

  if (!token) {
    window.location.href = "/admin/login.html";
    return;
  }

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: "Bearer " + token
    }
  });
}

/* ================= OPEN DOCUMENT FROM PINATA ================= */
function downloadFromIPFS(url, filename) {
  if (!url) {
    alert("Document not available");
    return;
  }

  console.log("OPENING DOCUMENT:", url);
  window.open(url, "_blank", "noopener,noreferrer");
}

/* ================= LOAD ORDERS ================= */
async function loadOrders() {
  const res = await adminFetch("/api/admin/orders");
  if (!res || !res.ok) return;

  const reports = await res.json();
  console.log("ADMIN ORDERS:", reports);

  const table = document.getElementById("ordersTable");
  table.innerHTML = "";

  document.getElementById("totalOrders").innerText = reports.length;
  document.getElementById("pendingOrders").innerText =
    reports.filter(r => r.status === "pending").length;
  document.getElementById("completedOrders").innerText =
    reports.filter(r => r.status === "completed").length;

  reports.forEach(r => {
    const aiDone = r.aiReport?.storedName;
    const plagDone = r.plagReport?.storedName;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <button class="view-btn"
          onclick="downloadFromIPFS('${r.fileURL}', '${r.filename}')">
          View Document
        </button>
      </td>

      <td>${r.filename}</td>
      <td class="${r.status}">${r.status}</td>

      <td>
        ${
          aiDone
            ? `<span class="tick">✔</span>
               <span class="delete"
                 onclick="deleteSingle('${r._id}','ai')">🗑</span>`
            : `<input type="file"
                 onchange="uploadReport('${r._id}','aiReport',this)">`
        }
      </td>

      <td>
        ${
          plagDone
            ? `<span class="tick">✔</span>
               <span class="delete"
                 onclick="deleteSingle('${r._id}','plag')">🗑</span>`
            : `<input type="file"
                 onchange="uploadReport('${r._id}','plagReport',this)">`
        }
      </td>

      <td>—</td>
    `;

    table.appendChild(row);
  });
}

/* ================= UPLOAD AI / PLAG REPORT ================= */
async function uploadReport(orderId, type, input) {
  const file = input.files[0];
  if (!file) return;

  const fd = new FormData();
  fd.append("orderId", orderId);
  fd.append(type, file);

  const res = await adminFetch("/api/admin/upload-report", {
    method: "POST",
    body: fd
  });

  if (!res || !res.ok) {
    alert("Upload failed");
    return;
  }

  loadOrders();
  loadMyStats();
}

/* ================= DELETE AI / PLAG ================= */
async function deleteSingle(orderId, type) {
  if (!confirm("Delete this file?")) return;

  const res = await adminFetch(
    `/api/admin/delete-report/${orderId}/${type}`,
    { method: "DELETE" }
  );

  if (!res || !res.ok) {
    alert("Delete failed");
    return;
  }

  loadOrders();
  loadMyStats();
}

/* ================= ADMIN STATUS ================= */
async function loadMyStats() {
  const from = document.getElementById("fromDate")?.value;
  const to = document.getElementById("toDate")?.value;

  let url = "/api/admin/activity-stats";
  const q = [];
  if (from) q.push(`from=${from}`);
  if (to) q.push(`to=${to}`);
  if (q.length) url += "?" + q.join("&");

  const res = await adminFetch(url);
  if (!res || !res.ok) return;

  const data = await res.json();
  document.getElementById("myCompleted").innerText =
    data.completedOrders;
}

/* ================= LOGOUT ================= */
function logoutAdmin() {
  localStorage.removeItem("adminToken");
  window.location.href = "/admin/login.html";
}

/* ================= INIT ================= */
console.log("✅ ADMIN DASHBOARD JS LOADED (JWT MODE)");
loadOrders();
loadMyStats();
