import { confirmPasswordReset } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// Read code from URL
const urlParams = new URLSearchParams(window.location.search);
const oobCode = urlParams.get("oobCode");  // Firebase reset code

document.getElementById("resetForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const newPass = document.getElementById("password").value;
  const confirmPass = document.getElementById("confirmPassword").value;
  const msg = document.getElementById("msg");

  if (newPass !== confirmPass) {
    msg.innerText = "Passwords do not match!";
    msg.classList.remove("hidden");
    return;
  }

  try {
    await confirmPasswordReset(auth, oobCode, newPass);

    msg.innerText = "✔ Password updated successfully!";
    msg.classList.remove("hidden");

    setTimeout(() => {
      window.location.href = "/login.html";
    }, 1500);

  } catch (error) {
    alert(error.message);
  }
});
