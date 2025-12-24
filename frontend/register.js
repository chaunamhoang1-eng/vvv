import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

function togglePassword() {
  const pass = document.getElementById("password");
  pass.type = pass.type === "password" ? "text" : "password";
}
window.togglePassword = togglePassword;

document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    await createUserWithEmailAndPassword(auth, email, password);

    const box = document.getElementById("successBox");
    box.classList.remove("hidden");
    box.innerText = "✔ Account Created Successfully!";

    setTimeout(() => {
      window.location.href = "/login.html";
    }, 1500);

  } catch (error) {
    alert(error.message);
  }
});
