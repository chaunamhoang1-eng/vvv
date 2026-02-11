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

/* ================= TIME FORMAT (UTC → IST) ================= */
function formatToIST(dateString) {
  if (!dateString) return "—";

  const date = new Date(dateString);
  return (
    date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }) + " IST"
  );
}

/* ================= OPEN DOCUMENT ================= */
function downloadFromIPFS(url) {
  if (!url) return alert("Document not available");
  window.open(url, "_blank", "noopener,noreferrer");
}

/* ================= SELECT STATE ================= */
let selectedOrders = [];

function toggleRow(id) {
  if (selectedOrders.includes(id)) {
    selectedOrders = selectedOrders.filter(x => x !== id);
  } else {
    selectedOrders.push(id);
  }
}

function toggleSelectAll() {
  const isChecked = document.getElementById("selectAll").checked;
  const boxes = document.querySelectorAll(".orderSelect");

  selectedOrders = [];

  boxes.forEach(cb => {
    cb.checked = isChecked;
    if (isChecked) selectedOrders.push(cb.value);
  });
}

/* ================= DELETE SINGLE ORDER ================= */
async function deleteOrder(orderId) {
  if (!confirm("Delete this entire order?")) return;

  const res = await adminFetch(`/api/admin/order/${orderId}`, {
    method: "DELETE"
  });

  if (!res.ok) return alert("Failed to delete order");

  loadOrders();
  loadMyStats();
}

/* ================= DELETE MULTIPLE ORDERS ================= */
async function deleteSelected() {
  if (selectedOrders.length === 0)
    return alert("No orders selected");

  if (!confirm(`Delete ${selectedOrders.length} selected orders?`)) return;

  const res = await adminFetch(`/api/admin/orders/multi-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: selectedOrders })
  });

  if (!res.ok) return alert("Failed to delete selected orders");

  selectedOrders = [];
  loadOrders();
  loadMyStats();
}

/* ================= LOAD ORDERS ================= */
async function loadOrders() {
  const res = await adminFetch("/api/admin/orders");
  if (!res || !res.ok) return;

  const reports = await res.json();
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
        <button class="view-btn" onclick="downloadFromIPFS('${r.fileURL}')">
          View
        </button>
      </td>

      <td>${r.filename}</td>
      <td>${formatToIST(r.createdAt)}</td>
      <td class="${r.status}">${r.status}</td>

      <td>
        ${
          aiDone
            ? `<span class="tick">✔</span><span class="delete" onclick="deleteSingle('${r._id}','ai')">🗑</span>`
            : `<input type="file" onchange="uploadReport('${r._id}','aiReport',this)">`
        }
      </td>

      <td>
        ${
          plagDone
            ? `<span class="tick">✔</span><span class="delete" onclick="deleteSingle('${r._id}','plag')">🗑</span>`
            : `<input type="file" onchange="uploadReport('${r._id}','plagReport',this)">`
        }
      </td>

      <td>
        <input type="checkbox" class="orderSelect" value="${r._id}" onclick="toggleRow('${r._id}')">
      </td>

      <td>
        <span class="delete" onclick="deleteOrder('${r._id}')">🗑 Delete</span>
      </td>
    `;

    table.appendChild(row);
  });
}

/* ================= DELETE AI / PLAG FILE ONLY ================= */
async function deleteSingle(orderId, type) {
  if (!confirm("Delete this uploaded report?")) return;

  const res = await adminFetch(`/api/admin/delete-report/${orderId}/${type}`, {
    method: "DELETE"
  });

  if (!res.ok) return alert("Delete failed");

  loadOrders();
}

/* ================= ADMIN STATS ================= */
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
  document.getElementById("myCompleted").innerText = data.completedOrders;
}

/* ================= LOGOUT ================= */
function logoutAdmin() {
  localStorage.removeItem("adminToken");
  window.location.href = "/admin/login.html";
}

/* ================= INIT ================= */
console.log("✔ Admin Dashboard Loaded");
loadOrders();
loadMyStats();
