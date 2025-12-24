// ======================= FIREBASE IMPORTS =======================
import {
  getAuth,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

const auth = getAuth();  // Already initialized in dashboard.html



// ======================= DISCORD POPUP =========================

window.addEventListener("load", () => {
  const shown = sessionStorage.getItem("dashboardPopupShown");

  if (!shown) {
    setTimeout(() => {
      document.getElementById("dashboardPopup").style.display = "flex";
    }, 1200);

    sessionStorage.setItem("dashboardPopupShown", "true");
  }
});

window.closePopup = function () {
  document.getElementById("dashboardPopup").style.display = "none";
};

window.openDiscord = function () {
  window.open("https://discord.gg/w7YyprcUN3", "_blank");
};



// ======================= FILE UPLOAD SYSTEM =======================
document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const file = document.getElementById("fileInput").files[0];
  if (!file) return alert("Select a file first!");

  alert("Upload feature will be connected to backend.");
});



// ======================= LOGOUT SYSTEM (FIREBASE) =======================
window.logout = async function () {
  try {
    await signOut(auth);     // Firebase logout
    window.location.href = "/login.html";
  } catch (error) {
    alert("Logout failed: " + error.message);
  }
};
