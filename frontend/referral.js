import { auth } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


let firebaseToken = null;


/* ======================================================
   FIREBASE TOKEN
====================================================== */

async function getFirebaseToken(
  forceRefresh = false
) {

  const user =
    auth.currentUser;

  if (!user) {

    throw new Error(
      "User not logged in"
    );

  }


  firebaseToken =
    await user.getIdToken(
      forceRefresh
    );


  return firebaseToken;
}


/* ======================================================
   AUTH FETCH
   SAME METHOD AS DASHBOARD.JS
====================================================== */

async function authFetch(
  url,
  options = {}
) {

  const token =
    await getFirebaseToken();

  const headers = {

    ...(options.headers || {}),

    Authorization:
      `Bearer ${token}`

  };


  return fetch(
    url,
    {
      ...options,
      headers
    }
  );

}


/* ======================================================
   LOAD REFERRAL DATA
====================================================== */

async function loadReferralData() {

  try {

    const response =
      await authFetch(
        "/api/referral/my-referral"
      );


    if (!response.ok) {

      console.error(
        "Referral API error:",
        response.status
      );


      throw new Error(
        "Unable to load referral information"
      );

    }


    const data =
      await response.json();


    console.log(
      "Referral data:",
      data
    );


    /* REFERRAL LINK */

    const referralLink =
      document.getElementById(
        "referralLink"
      );


    if (
      referralLink &&
      data.referralLink
    ) {

      referralLink.value =
        data.referralLink;

    }


    /* REFERRAL CODE */

    const referralCode =
      document.getElementById(
        "referralCode"
      );


    if (
      referralCode &&
      data.referralCode
    ) {

      referralCode.textContent =
        data.referralCode;

    }


    /* TOTAL REFERRALS */

    const referralCount =
      document.getElementById(
        "referralCount"
      );


    if (referralCount) {

      referralCount.textContent =
        data.referralCount || 0;

    }


    /* TOTAL REWARDS */

    const rewardCount =
      document.getElementById(
        "rewardCount"
      );


    if (rewardCount) {

      rewardCount.textContent =
        data.referralRewards || 0;

    }


    /* STATUS */

    const status =
      document.getElementById(
        "referralStatus"
      );


    if (status) {

      status.textContent = "";

    }


  } catch (error) {

    console.error(
      "Referral error:",
      error
    );


    const status =
      document.getElementById(
        "referralStatus"
      );


    if (status) {

      status.textContent =
        error.message;

    }

  }

}


/* ======================================================
   AUTH STATE
   SAME PATTERN AS DASHBOARD
====================================================== */

onAuthStateChanged(
  auth,

  async (user) => {

    if (!user) {

      window.location.href =
        "/login.html";

      return;

    }


    console.log(
      "Firebase user:",
      user.email
    );


    try {

      /*
        Get fresh Firebase token first,
        exactly like dashboard.js
      */

      await getFirebaseToken(
        true
      );


      /*
        Then load referral data
      */

      await loadReferralData();


    } catch (error) {

      console.error(
        "Referral initialization error:",
        error
      );

    }

  }

);


/* ======================================================
   COPY REFERRAL LINK
====================================================== */

window.copyReferralLink =
  async function () {

    const input =
      document.getElementById(
        "referralLink"
      );


    if (
      !input ||
      !input.value
    ) {

      alert(
        "Referral link not loaded yet."
      );

      return;

    }


    try {

      await navigator.clipboard.writeText(
        input.value
      );


      const button =
        document.getElementById(
          "copyReferralBtn"
        );


      if (button) {

        const originalText =
          button.textContent;


        button.textContent =
          "Copied ✓";


        setTimeout(
          () => {

            button.textContent =
              originalText;

          },
          2000
        );

      }


    } catch (error) {

      console.error(
        "Copy failed:",
        error
      );


      input.select();


      document.execCommand(
        "copy"
      );

    }

  };


/* ======================================================
   SHARE REFERRAL LINK
====================================================== */

window.shareReferralLink =
  async function () {

    const input =
      document.getElementById(
        "referralLink"
      );


    if (
      !input ||
      !input.value
    ) {

      alert(
        "Referral link not loaded yet."
      );

      return;

    }


    try {

      if (navigator.share) {

        await navigator.share({

          title:
            "Join PlagX",

          text:
            "Join PlagX using my referral link!",

          url:
            input.value

        });

      } else {

        await navigator.clipboard.writeText(
          input.value
        );


        alert(
          "Referral link copied!"
        );

      }

    } catch (error) {

      if (
        error.name !== "AbortError"
      ) {

        console.error(
          "Share failed:",
          error
        );

      }

    }

  };
