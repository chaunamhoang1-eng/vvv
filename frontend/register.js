import {
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";


/* ======================================================
   SHOW / HIDE PASSWORD
====================================================== */

function togglePassword() {

  const pass =
    document.getElementById("password");

  pass.type =
    pass.type === "password"
      ? "text"
      : "password";
}

window.togglePassword =
  togglePassword;


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
   START COUNTDOWN
====================================================== */

function startCountdown(seconds = 60) {

  clearInterval(countdownTimer);

  let remaining = seconds;

  resendOtpBtn.disabled = true;

  countdown.innerText =
    remaining;

  countdownTimer =
    setInterval(() => {

      remaining--;

      countdown.innerText =
        remaining;

      if (remaining <= 0) {

        clearInterval(
          countdownTimer
        );

        resendOtpBtn.disabled =
          false;

        resendOtpBtn.innerHTML =
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
         FIREBASE ACCOUNT
      ---------------------------------------------- */

      const credential =
        await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );


      /* ----------------------------------------------
         GET FIREBASE TOKEN
      ---------------------------------------------- */

      const token =
        await credential.user.getIdToken();


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


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.error ||
          "Unable to send OTP"
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
        "Verification code sent!";

      startCountdown(60);

      otpInput.focus();


    } catch (error) {

      console.error(
        "Registration error:",
        error
      );

      alert(
        error.message ||
        "Registration failed"
      );

      registerBtn.disabled =
        false;

      registerBtn.innerText =
        "Register →";
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
         GET CURRENT FIREBASE USER
      ---------------------------------------------- */

      const user =
        auth.currentUser;


      if (!user) {

        throw new Error(
          "Session expired. Please register again."
        );
      }


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


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.error ||
          "Invalid OTP"
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


      setTimeout(() => {

        window.location.href =
          "/login.html";

      }, 1500);


    } catch (error) {

      console.error(
        "OTP verification error:",
        error
      );

      otpMessage.innerText =
        error.message ||
        "Invalid OTP";

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


      const user =
        auth.currentUser;


      if (!user) {

        throw new Error(
          "Session expired. Please register again."
        );
      }


      const token =
        await user.getIdToken(
          true
        );


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


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.error ||
          "Unable to resend OTP"
        );
      }


      otpMessage.innerText =
        "A new OTP has been sent.";

      otpInput.value = "";

      otpInput.focus();

      startCountdown(
        data.remaining || 60
      );


    } catch (error) {

      console.error(
        "Resend OTP error:",
        error
      );

      otpMessage.innerText =
        error.message ||
        "Unable to resend OTP";

      resendOtpBtn.disabled =
        false;

      resendOtpBtn.innerText =
        "Resend OTP";
    }
  }
);
