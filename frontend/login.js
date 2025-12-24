// Firebase Auth imports
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

/* ================================
   Show / Hide Password
================================ */
function togglePassword() {
  const pass = document.getElementById("password");
  pass.type = pass.type === "password" ? "text" : "password";
}
window.togglePassword = togglePassword;  // make available to HTML onclick

/* ================================
   Handle Login Form Submit
================================ */
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const box = document.getElementById("successBox");

  try {
    // Firebase login
    await signInWithEmailAndPassword(auth, email, password);

    // Show success message
    box.innerText = "✔ Login Successful!";
    box.classList.remove("hidden");

    // Redirect to dashboard
    setTimeout(() => {
      window.location.href = "/dashboard.html";
    }, 1500);

  } catch (error) {
    alert(error.message); // Firebase error message
  }
});
