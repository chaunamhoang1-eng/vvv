import {
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";


/* ======================================================
   DOM
====================================================== */

const form =
  document.getElementById("forgotForm");

const emailInput =
  document.getElementById("email");

const messageBox =
  document.getElementById("message");

const resetButton =
  document.getElementById("resetButton");


/* ======================================================
   FORM SUBMIT
====================================================== */

form.addEventListener(
  "submit",
  async (e) => {

    e.preventDefault();


    /* ==================================================
       CLEAR MESSAGE
    ================================================== */

    messageBox.textContent = "";

    messageBox.style.color = "";


    /* ==================================================
       EMAIL
    ================================================== */

    const email =
      emailInput.value
        .trim()
        .toLowerCase();


    if (!email) {

      messageBox.style.color =
        "#dc2626";

      messageBox.textContent =
        "❌ Please enter your email.";

      return;
    }


    /* ==================================================
       FIREBASE CHECK
    ================================================== */

    if (!window.auth) {

      console.error(
        "❌ Firebase Auth is not initialized"
      );

      messageBox.style.color =
        "#dc2626";

      messageBox.textContent =
        "❌ Authentication service unavailable. Please refresh the page.";

      return;
    }


    /* ==================================================
       DISABLE BUTTON
    ================================================== */

    resetButton.disabled = true;

    resetButton.textContent =
      "Sending...";


    try {

      /* ==================================================
         SEND RESET EMAIL
      ================================================== */

      await sendPasswordResetEmail(
        window.auth,
        email
      );


      /* ==================================================
         SUCCESS
      ================================================== */

      messageBox.style.color =
        "#16a34a";

      messageBox.textContent =
        "✅ Reset link sent. Check your email.";


      emailInput.value = "";


    } catch (error) {

      console.error(
        "❌ Password reset error:",
        error
      );


      /* ==================================================
         ERROR
      ================================================== */

      messageBox.style.color =
        "#dc2626";


      if (
        error.code ===
        "auth/user-not-found"
      ) {

        messageBox.textContent =
          "❌ No account found with this email.";

      }

      else if (
        error.code ===
        "auth/invalid-email"
      ) {

        messageBox.textContent =
          "❌ Please enter a valid email address.";

      }

      else if (
        error.code ===
        "auth/too-many-requests"
      ) {

        messageBox.textContent =
          "❌ Too many requests. Please try again later.";

      }

      else {

        messageBox.textContent =
          "❌ " +
          (error.message ||
            "Unable to send reset email.");

      }

    }


    /* ==================================================
       ENABLE BUTTON
    ================================================== */

    finally {

      resetButton.disabled =
        false;

      resetButton.textContent =
        "Send Reset Link";

    }

  }
);
