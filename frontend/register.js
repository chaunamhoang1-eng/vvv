import {
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";


/* ======================================================
   REFERRAL CODE
====================================================== */

const urlParams =
  new URLSearchParams(
    window.location.search
  );

const referralCodeFromURL =
  urlParams
    .get("ref")
    ?.trim()
    .toUpperCase() ||
  null;


/*
 * Save referral code from referral URL.
 *
 * Example:
 * /register.html?ref=CEAB24B9
 */
if (referralCodeFromURL) {

  localStorage.setItem(
    "pendingReferralCode",
    referralCodeFromURL
  );

  console.log(
    "🎁 Referral code detected:",
    referralCodeFromURL
  );

}


function getReferralCode() {

  return (
    localStorage
      .getItem(
        "pendingReferralCode"
      )
      ?.trim()
      .toUpperCase() ||
    null
  );

}


/* ======================================================
   SHOW / HIDE PASSWORD
====================================================== */

function togglePassword() {

  const pass =
    document.getElementById(
      "password"
    );


  if (!pass) {
    return;
  }


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
  document.getElementById(
    "registerForm"
  );


const registerBtn =
  document.getElementById(
    "registerBtn"
  );


const otpBox =
  document.getElementById(
    "otpBox"
  );


const otpEmail =
  document.getElementById(
    "otpEmail"
  );


const otpInput =
  document.getElementById(
    "otp"
  );


const verifyOtpBtn =
  document.getElementById(
    "verifyOtpBtn"
  );


const resendOtpBtn =
  document.getElementById(
    "resendOtpBtn"
  );


const countdown =
  document.getElementById(
    "countdown"
  );


const otpMessage =
  document.getElementById(
    "otpMessage"
  );


const successBox =
  document.getElementById(
    "successBox"
  );


let countdownTimer =
  null;


let registeredEmail =
  null;


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

function startCountdown(
  seconds = 60
) {

  clearInterval(
    countdownTimer
  );


  let remaining =
    seconds;


  resendOtpBtn.disabled =
    true;


  if (countdown) {

    countdown.innerText =
      remaining;

  }


  countdownTimer =
    setInterval(
      () => {

        remaining--;


        if (
          remaining > 0
        ) {

          if (countdown) {

            countdown.innerText =
              remaining;

          }

        }


        if (
          remaining <= 0
        ) {

          clearInterval(
            countdownTimer
          );


          resendOtpBtn.disabled =
            false;


          resendOtpBtn.innerHTML =
            "Resend OTP";

        }

      },

      1000
    );

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
        .getElementById(
          "email"
        )
        .value
        .trim()
        .toLowerCase();


    const password =
      document
        .getElementById(
          "password"
        )
        .value;


    if (
      !email ||
      !password
    ) {

      alert(
        "Please enter email and password."
      );

      return;

    }


    if (
      password.length < 6
    ) {

      alert(
        "Password must be at least 6 characters."
      );

      return;

    }


    try {

      registerBtn.disabled =
        true;


      registerBtn.innerText =
        "Creating account...";


      /* ==============================================
         CHECK FIREBASE
      ============================================== */

      const firebaseAuth =
        checkFirebaseAuth();


      /* ==============================================
         CREATE FIREBASE ACCOUNT
      ============================================== */

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


      /* ==============================================
         GET FRESH FIREBASE TOKEN
      ============================================== */

      const token =
        await credential.user.getIdToken(
          true
        );


      /* ==============================================
         GET REFERRAL CODE
      ============================================== */

      const referralCode =
        getReferralCode();


      console.log(
        "🎁 Sending referral code:",
        referralCode
      );


      /* ==============================================
         SEND OTP + REFERRAL CODE TO BACKEND
      ============================================== */

      registerBtn.innerText =
        "Sending OTP...";


      const response =
        await fetch(

          "/auth/send-otp",

          {

            method:
              "POST",


            headers: {

              "Content-Type":
                "application/json",


              "Authorization":
                `Bearer ${token}`

            },


            body:
              JSON.stringify({

                referralCode:
                  referralCode

              })

          }

        );


      let data =
        {};


      try {

        data =
          await response.json();

      } catch {

        data =
          {};

      }


      if (
        !response.ok
      ) {

        throw new Error(

          data.error ||

          data.message ||

          "Unable to send OTP."

        );

      }


      /* ==============================================
         SAVE EMAIL
      ============================================== */

      registeredEmail =
        email;


      /* ==============================================
         SHOW OTP SCREEN
      ============================================== */

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


      startCountdown(
        60
      );


      otpInput.focus();


    } catch (error) {

      console.error(
        "❌ Registration error:",
        error
      );


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


      alert(
        message
      );


      registerBtn.disabled =
        false;


      registerBtn.innerText =
        "Create Account";

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


    if (
      !/^\d{6}$/.test(
        otp
      )
    ) {

      otpMessage.innerText =
        "Please enter a valid 6-digit OTP.";

      return;

    }


    try {

      verifyOtpBtn.disabled =
        true;


      verifyOtpBtn.innerText =
        "Verifying...";


      const firebaseAuth =
        checkFirebaseAuth();


      const user =
        firebaseAuth.currentUser;


      if (!user) {

        throw new Error(
          "Your session has expired. Please register again."
        );

      }


      const token =
        await user.getIdToken(
          true
        );


      const response =
        await fetch(

          "/auth/verify-otp",

          {

            method:
              "POST",


            headers: {

              "Content-Type":
                "application/json",


              "Authorization":
                `Bearer ${token}`

            },


            body:
              JSON.stringify({

                otp:
                  otp

              })

          }

        );


      let data =
        {};


      try {

        data =
          await response.json();

      } catch {

        data =
          {};

      }


      if (
        !response.ok
      ) {

        throw new Error(

          data.error ||
          "Invalid OTP."

        );

      }


      /* ==============================================
         SUCCESS
      ============================================== */

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


      /*
       * Remove saved referral only after
       * successful registration and verification.
       */
      localStorage.removeItem(
        "pendingReferralCode"
      );


      /* ==============================================
         REDIRECT
      ============================================== */

      setTimeout(
        () => {

          window.location.href =
            "/login.html";

        },

        1500
      );


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


      const firebaseAuth =
        checkFirebaseAuth();


      const user =
        firebaseAuth.currentUser;


      if (!user) {

        throw new Error(
          "Your session has expired. Please register again."
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

            method:
              "POST",


            headers: {

              "Content-Type":
                "application/json",


              "Authorization":
                `Bearer ${token}`

            }

          }

        );


      let data =
        {};


      try {

        data =
          await response.json();

      } catch {

        data =
          {};

      }


      if (
        !response.ok
      ) {

        throw new Error(

          data.error ||
          "Unable to resend OTP."

        );

      }


      otpMessage.innerText =
        "Verification code sent again.";


      startCountdown(
        60
      );


      otpInput.focus();


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


/* ======================================================
   ONLY ALLOW NUMBERS IN OTP
====================================================== */

otpInput.addEventListener(

  "input",

  () => {

    otpInput.value =
      otpInput.value.replace(
        /\D/g,
        ""
      );

  }

);
