/* ================= LOAD ORDERS ================= */
async function loadOrders() {
  const res = await fetch("/api/admin/orders", {
    credentials: "include"
  });

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
    const aiDone = r.aiReport?.storedName;
    const plagDone = r.plagReport?.storedName;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${r.email}</td>
      <td>${r.filename}</td>
      <td class="${r.status}">${r.status}</td>

      <td>
        ${
          aiDone
            ? `<span class="tick">✔</span>
               <span class="delete" onclick="deleteSingle('${r._id}','ai')">🗑</span>`
            : `<input type="file"
                 onchange="uploadReport('${r._id}','aiReport',this)">`
        }
      </td>

      <td>
        ${
          plagDone
            ? `<span class="tick">✔</span>
               <span class="delete" onclick="deleteSingle('${r._id}','plag')">🗑</span>`
            : `<input type="file"
                 onchange="uploadReport('${r._id}','plagReport',this)">`
        }
      </td>

      <td>—</td>
    `;
    table.appendChild(row);
  });
}

/* ================= UPLOAD ================= */
async function uploadReport(orderId, type, input) {
  const file = input.files[0];
  if (!file) return;

  const fd = new FormData();
  fd.append("orderId", orderId);
  fd.append(type, file);

  await fetch("/api/admin/upload-report", {
    method: "POST",
    body: fd,
    credentials: "include"
  });

  loadOrders();
  loadMyStats();
}

/* ================= DELETE AI / PLAG ================= */
async function deleteSingle(orderId, type) {
  if (!confirm("Delete this file?")) return;

  const res = await fetch(
    `/api/admin/delete-report/${orderId}/${type}`,
    {
      method: "DELETE",
      credentials: "include"
    }
  );

  if (!res.ok) {
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

  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) return;

  const data = await res.json();
  document.getElementById("myCompleted").innerText =
    data.completedOrders;
}

/* ================= LOGOUT ================= */
async function logoutAdmin() {
  await fetch("/api/admin/logout", { credentials: "include" });
  window.location.href = "/admin/login.html";
}

/* ================= INIT ================= */
loadOrders();
loadMyStats();
