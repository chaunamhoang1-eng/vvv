import {
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";


/* ======================================================
   SHOW / HIDE PASSWORD
====================================================== */

function togglePassword() {
  const pass = document.getElementById("password");

  pass.type =
    pass.type === "password"
      ? "text"
      : "password";
}

window.togglePassword = togglePassword;


/* ======================================================
   ELEMENTS
====================================================== */

const registerForm =
  document.getElementById("registerForm");

const registerBtn =
  document.getElementById("registerBtn");

const otpBox =
  document.getElementById("otpBox");

const otpEmail =
  document.getElementById("otpEmail");

const otpInput =
  document.getElementById("otp");

const verifyOtpBtn =
  document.getElementById("verifyOtpBtn");

const resendOtpBtn =
  document.getElementById("resendOtpBtn");

const countdown =
  document.getElementById("countdown");

const otpMessage =
  document.getElementById("otpMessage");

const successBox =
  document.getElementById("successBox");


let countdownTimer = null;


/* ======================================================
   CHECK FIREBASE
====================================================== */

function checkFirebaseAuth() {

  if (!window.auth) {

    throw new Error(
      "Firebase Auth is not initialized. Please refresh the page."
    );

  }

  return window.auth;
}


/* ======================================================
   START COUNTDOWN
====================================================== */

function startCountdown(seconds = 60) {

  clearInterval(countdownTimer);

  let remaining = seconds;

  resendOtpBtn.disabled = true;

  resendOtpBtn.innerText =
    `Resend OTP (${remaining}s)`;


  countdownTimer =
    setInterval(() => {

      remaining--;

      if (remaining > 0) {

        resendOtpBtn.innerText =
          `Resend OTP (${remaining}s)`;

      }


      if (remaining <= 0) {

        clearInterval(countdownTimer);

        resendOtpBtn.disabled = false;

        resendOtpBtn.innerText =
          "Resend OTP";

      }

    }, 1000);
}


/* ======================================================
   REGISTER
====================================================== */

registerForm.addEventListener(
  "submit",
  async (e) => {

    e.preventDefault();


    const email =
      document
        .getElementById("email")
        .value
        .trim()
        .toLowerCase();


    const password =
      document
        .getElementById("password")
        .value;


    if (!email || !password) {

      alert(
        "Please enter email and password."
      );

      return;
    }


    try {

      registerBtn.disabled = true;

      registerBtn.innerText =
        "Creating account...";


      /* ----------------------------------------------
         CHECK FIREBASE
      ---------------------------------------------- */

      const firebaseAuth =
        checkFirebaseAuth();


      /* ----------------------------------------------
         CREATE FIREBASE ACCOUNT
      ---------------------------------------------- */

      const credential =
        await createUserWithEmailAndPassword(
          firebaseAuth,
          email,
          password
        );


      console.log(
        "✅ Firebase account created:",
        credential.user.uid
      );


      /* ----------------------------------------------
         GET FIREBASE ID TOKEN
      ---------------------------------------------- */

      const token =
        await credential.user.getIdToken(
          true
        );


      /* ----------------------------------------------
         SEND OTP TO BACKEND
      ---------------------------------------------- */

      const response =
        await fetch(
          "/auth/send-otp",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "Authorization":
                `Bearer ${token}`
            }
          }
        );


      let data = {};

      try {

        data =
          await response.json();

      } catch {

        data = {};

      }


      if (!response.ok) {

        throw new Error(
          data.error ||
          "Unable to send OTP."
        );

      }


      /* ----------------------------------------------
         SHOW OTP BOX
      ---------------------------------------------- */

      registerForm.classList.add(
        "hidden"
      );

      otpBox.classList.remove(
        "hidden"
      );


      otpEmail.innerText =
        email;


      otpMessage.innerText =
        "Verification code sent to your email.";


      startCountdown(60);


      otpInput.focus();


    } catch (error) {

      console.error(
        "❌ Registration error:",
        error
      );


      /* ----------------------------------------------
         FRIENDLY FIREBASE ERRORS
      ---------------------------------------------- */

      let message =
        error.message ||
        "Registration failed.";


      if (
        error.code ===
        "auth/email-already-in-use"
      ) {

        message =
          "This email is already registered. Please login instead.";

      }


      if (
        error.code ===
        "auth/weak-password"
      ) {

        message =
          "Password should be at least 6 characters.";

      }


      if (
        error.code ===
        "auth/invalid-email"
      ) {

        message =
          "Please enter a valid email address.";

      }


      if (
        error.code ===
        "auth/network-request-failed"
      ) {

        message =
          "Network error. Please check your internet connection.";

      }


      alert(message);


      registerBtn.disabled =
        false;

      registerBtn.innerText =
        "Create Account →";

    }

  }
);


/* ======================================================
   VERIFY OTP
====================================================== */

verifyOtpBtn.addEventListener(
  "click",
  async () => {

    const otp =
      otpInput.value.trim();


    /* ----------------------------------------------
       VALIDATE OTP
    ---------------------------------------------- */

    if (!/^\d{6}$/.test(otp)) {

      otpMessage.innerText =
        "Please enter a valid 6-digit OTP.";

      return;
    }


    try {

      verifyOtpBtn.disabled =
        true;

      verifyOtpBtn.innerText =
        "Verifying...";


      /* ----------------------------------------------
         GET FIREBASE AUTH
      ---------------------------------------------- */

      const firebaseAuth =
        checkFirebaseAuth();


      const user =
        firebaseAuth.currentUser;


      if (!user) {

        throw new Error(
          "Your session has expired. Please register again."
        );

      }


      /* ----------------------------------------------
         GET FRESH FIREBASE TOKEN
      ---------------------------------------------- */

      const token =
        await user.getIdToken(
          true
        );


      /* ----------------------------------------------
         VERIFY OTP
      ---------------------------------------------- */

      const response =
        await fetch(
          "/auth/verify-otp",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "Authorization":
                `Bearer ${token}`
            },

            body: JSON.stringify({
              otp
            })
          }
        );


      let data = {};

      try {

        data =
          await response.json();

      } catch {

        data = {};

      }


      if (!response.ok) {

        throw new Error(
          data.error ||
          "Invalid OTP."
        );

      }


      /* ----------------------------------------------
         SUCCESS
      ---------------------------------------------- */

      clearInterval(
        countdownTimer
      );


      otpBox.classList.add(
        "hidden"
      );


      successBox.classList.remove(
        "hidden"
      );


      successBox.innerText =
        "✔ Email verified successfully!";


      /* ----------------------------------------------
         REDIRECT
      ---------------------------------------------- */

      setTimeout(() => {

        window.location.href =
          "/login.html";

      }, 1500);


    } catch (error) {

      console.error(
        "❌ OTP verification error:",
        error
      );


      otpMessage.innerText =
        error.message ||
        "Invalid OTP.";


      verifyOtpBtn.disabled =
        false;

      verifyOtpBtn.innerText =
        "Verify OTP";

    }

  }
);


/* ======================================================
   RESEND OTP
====================================================== */

resendOtpBtn.addEventListener(
  "click",
  async () => {

    try {

      resendOtpBtn.disabled =
        true;

      resendOtpBtn.innerText =
        "Sending...";


      /* ----------------------------------------------
         GET FIREBASE AUTH
      ---------------------------------------------- */

      const firebaseAuth =
        checkFirebaseAuth();


      const user =
        firebaseAuth.currentUser;


      if (!user) {

        throw new Error(
          "Your session has expired. Please register again."
        );

      }


      /* ----------------------------------------------
         GET TOKEN
      ---------------------------------------------- */

      const token =
        await user.getIdToken(
          true
        );


      /* ----------------------------------------------
         RESEND OTP
      ---------------------------------------------- */

      const response =
        await fetch(
          "/auth/resend-otp",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "Authorization":
                `Bearer ${token}`
            }
          }
        );


      let data = {};

      try {

        data =
          await response.json();

      } catch {

        data = {};

      }


      if (!response.ok) {

        throw new Error(
          data.error ||
          "Unable to resend OTP."
        );

      }


      /* ----------------------------------------------
         SUCCESS
      ---------------------------------------------- */

      otpMessage.innerText =
        "A new OTP has been sent to your email.";


      otpInput.value = "";

      otpInput.focus();


      startCountdown(
        data.remaining || 60
      );


    } catch (error) {

      console.error(
        "❌ Resend OTP error:",
        error
      );


      otpMessage.innerText =
        error.message ||
        "Unable to resend OTP.";


      resendOtpBtn.disabled =
        false;

      resendOtpBtn.innerText =
        "Resend OTP";

    }

  }
);
