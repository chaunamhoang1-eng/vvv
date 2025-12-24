import {
  getAuth,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

const auth = getAuth();

document.getElementById("forgotForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const box = document.getElementById("messageBox");

  try {
    await sendPasswordResetEmail(auth, email);

    box.classList.remove("hidden");
    box.style.background = "#d4fcd6";
    box.innerText = "Reset link sent! Check your email.";
  } catch (error) {
    box.classList.remove("hidden");
    box.style.background = "#ffe1e1";
    box.innerText = "Error: " + error.message;
  }
});
