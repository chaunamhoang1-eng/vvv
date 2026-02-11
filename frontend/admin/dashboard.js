/* ================= JWT FETCH ================= */
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

/* ================= DATE FORMAT ================= */
function formatToIST(dateString) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  return (
    d.toLocaleString("en-IN", {
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

/* ================= SELECTION ================= */
let selectedOrders = [];

function toggleRow(id) {
  if (selectedOrders.includes(id)) {
    selectedOrders = selectedOrders.filter(x => x !== id);
  } else {
    selectedOrders.push(id);
  }
}

function toggleSelectAll() {
  const state = document.getElementById("selectAll").checked;
  const boxes = document.querySelectorAll(".orderSelect");

  selectedOrders = [];
  boxes.forEach(b => {
    b.checked = state;
    if (state) selectedOrders.push(b.value);
  });
}

/* ================= DELETE ORDER ================= */
async function deleteOrder(id) {
  if (!confirm("Delete this order?")) return;

  const res = await adminFetch(`/api/admin/order/${id}`, { method: "DELETE" });
  if (!res.ok) return alert("Delete failed");

  loadOrders();
  loadMyStats();
}

/* ================= DELETE SELECTED ================= */
async function deleteSelected() {
  if (selectedOrders.length === 0) return alert("No orders selected");

  if (!confirm(`Delete ${selectedOrders.length} orders?`)) return;

  const res = await adminFetch(`/api/admin/orders/multi-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: selectedOrders })
  });

  if (!res.ok) return alert("Failed");

  selectedOrders = [];
  loadOrders();
  loadMyStats();
}

/* ================= LOAD ORDERS ================= */
async function loadOrders() {
  const res = await adminFetch("/api/admin/orders");
  if (!res.ok) return;

  const reports = await res.json();
  const table = document.getElementById("ordersTable");
  table.innerHTML = "";

  document.getElementById("totalOrders").innerText = reports.length;
  document.getElementById("pendingOrders").innerText =
    reports.filter(r => r.status === "pending").length;
  document.getElementById("completedOrders").innerText =
    reports.filter(r => r.status === "completed").length;

  reports.forEach(r => {
    const ai = r.aiReport?.storedName;
    const plag = r.plagReport?.storedName;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><button class="view-btn" onclick="window.open('${r.fileURL}', '_blank')">View Document</button></td>
      <td>${r.filename}</td>
      <td>${formatToIST(r.createdAt)}</td>
      <td class="${r.status}">${r.status}</td>

      <td>
        ${
          ai
            ? `<span class="tick">✔</span><span class="delete" onclick="deleteSingle('${r._id}','ai')">🗑</span>`
            : `<input type="file" onchange="uploadReport('${r._id}','aiReport',this)">`
        }
      </td>

      <td>
        ${
          plag
            ? `<span class="tick">✔</span><span class="delete" onclick="deleteSingle('${r._id}','plag')">🗑</span>`
            : `<input type="file" onchange="uploadReport('${r._id}','plagReport',this)">`
        }
      </td>

      <td><input type="checkbox" class="orderSelect" value="${r._id}" onclick="toggleRow('${r._id}')"></td>

      <td><span class="delete" onclick="deleteOrder('${r._id}')">🗑 Delete</span></td>
    `;

    table.appendChild(row);
  });
}

/* ================= DELETE SINGLE REPORT ================= */
async function deleteSingle(orderId, type) {
  if (!confirm("Delete this file?")) return;

  const res = await adminFetch(`/api/admin/delete-report/${orderId}/${type}`, {
    method: "DELETE"
  });

  if (!res.ok) return alert("Delete failed");

  loadOrders();
}

/* ================= ADMIN STATS ================= */
async function loadMyStats() {
  const from = document.getElementById("fromDate").value;
  const to = document.getElementById("toDate").value;

  let url = "/api/admin/activity-stats";
  const params = [];
  if (from) params.push(`from=${from}`);
  if (to) params.push(`to=${to}`);

  if (params.length) url += "?" + params.join("&");

  const res = await adminFetch(url);
  if (res.ok) {
    const data = await res.json();
    document.getElementById("myCompleted").innerText = data.completedOrders;
  }
}

/* ================= LOGOUT ================= */
function logoutAdmin() {
  localStorage.removeItem("adminToken");
  window.location.href = "/admin/login.html";
}

/* ================= INIT ================= */
loadOrders();
loadMyStats();
console.log("✔ Admin Dashboard Loaded");
