import { auth } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


/* =====================================================
   VARIABLES
===================================================== */

let currentUser = null;
let referralDataLoaded = false;


/* =====================================================
   WAIT FOR FIREBASE AUTH STATE
===================================================== */

onAuthStateChanged(auth, async (user) => {

  console.log(
    "🔐 Firebase auth:",
    user ? user.email : "No user"
  );


  if (!user) {

    console.warn(
      "⚠️ No logged-in Firebase user"
    );

    window.location.href = "/login.html";

    return;
  }


  currentUser = user;


  console.log(
    "✅ Logged-in user:",
    currentUser.email
  );


  if (!referralDataLoaded) {

    referralDataLoaded = true;

    await loadReferralData();

  }

});


/* =====================================================
   GET VALID FIREBASE ID TOKEN
===================================================== */

async function getFirebaseToken(forceRefresh = false) {

  if (!currentUser) {

    throw new Error(
      "No Firebase user available"
    );

  }


  const token =
    await currentUser.getIdToken(
      forceRefresh
    );


  console.log(
    "🔑 Firebase token type:",
    typeof token
  );


  console.log(
    "🔑 Firebase token length:",
    token ? token.length : 0
  );


  console.log(
    "🔑 JWT sections:",
    token ? token.split(".").length : 0
  );


  /* ==========================================
     VALIDATE TOKEN
  ========================================== */

  if (
    !token ||
    typeof token !== "string"
  ) {

    throw new Error(
      "Firebase did not return a valid token"
    );

  }


  /*
    A JWT has 3 sections:
    header.payload.signature
  */

  if (
    token.split(".").length !== 3
  ) {

    console.error(
      "❌ Invalid token received:",
      token
    );

    throw new Error(
      "Invalid Firebase JWT format"
    );

  }


  return token;

}


/* =====================================================
   FETCH REFERRAL DATA
===================================================== */

async function loadReferralData() {

  try {

    console.log(
      "📡 Loading referral data..."
    );


    /* ==========================================
       GET TOKEN
    ========================================== */

    let token =
      await getFirebaseToken(true);


    console.log(
      "🔑 Token starts with:",
      token.substring(0, 20)
    );


    /* ==========================================
       FIRST REQUEST
    ========================================== */

    let response =
      await fetch(
        "/api/referral/my-referral",
        {
          method: "GET",

          headers: {
            "Authorization":
              `Bearer ${token}`
          }
        }
      );


    /* ==========================================
       RETRY ONLY ONCE
    ========================================== */

    if (response.status === 401) {

      console.warn(
        "⚠️ First token rejected. Refreshing..."
      );


      token =
        await getFirebaseToken(true);


      response =
        await fetch(
          "/api/referral/my-referral",
          {
            method: "GET",

            headers: {
              "Authorization":
                `Bearer ${token}`
            }
          }
        );

    }


    /* ==========================================
       HANDLE FINAL ERROR
    ========================================== */

    if (!response.ok) {

      let errorData = {};

      try {

        errorData =
          await response.json();

      } catch (error) {

        console.error(
          "Unable to parse server error"
        );

      }


      console.error(
        "❌ Referral request failed"
      );


      console.error(
        "Status:",
        response.status
      );


      console.error(
        "Server response:",
        errorData
      );


      showReferralError(

        errorData.message ||

        `Unable to load referral information (${response.status})`

      );


      return;

    }


    /* ==========================================
       SUCCESS
    ========================================== */

    const data =
      await response.json();


    console.log(
      "✅ Referral data:",
      data
    );


    updateReferralUI(data);


  } catch (error) {

    console.error(
      "❌ Referral loading error:",
      error
    );


    showReferralError(
      error.message ||
      "Unable to load referral information."
    );

  }

}


/* =====================================================
   UPDATE REFERRAL PAGE
===================================================== */

function updateReferralUI(data) {

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


  const referralCount =
    document.getElementById(
      "referralCount"
    );


  if (referralCount) {

    referralCount.textContent =
      data.referralCount || 0;

  }


  const rewardCount =
    document.getElementById(
      "rewardCount"
    );


  if (rewardCount) {

    rewardCount.textContent =
      data.referralRewards || 0;

  }


  const status =
    document.getElementById(
      "referralStatus"
    );


  if (status) {

    status.textContent = "";

  }

}


/* =====================================================
   SHOW ERROR
===================================================== */

function showReferralError(message) {

  console.error(
    "❌ Referral error:",
    message
  );


  const status =
    document.getElementById(
      "referralStatus"
    );


  if (status) {

    status.textContent =
      message;

    status.style.color =
      "#dc2626";

  }

}


/* =====================================================
   COPY REFERRAL LINK
===================================================== */

window.copyReferralLink =
  async function () {

    const input =
      document.getElementById(
        "referralLink"
      );


    if (!input) {

      console.error(
        "❌ Referral link input not found"
      );

      return;

    }


    if (!input.value) {

      alert(
        "Referral link is still loading."
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
          "✓ Copied";


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
        "Clipboard copy failed:",
        error
      );


      /*
        Fallback copy method
      */

      input.select();

      input.setSelectionRange(
        0,
        99999
      );


      document.execCommand(
        "copy"
      );

    }

  };


/* =====================================================
   SHARE REFERRAL LINK
===================================================== */

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
        "Referral link is still loading."
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
