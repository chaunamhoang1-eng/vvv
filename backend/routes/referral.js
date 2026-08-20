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
   IMPORTANT:
   Do NOT immediately check auth.currentUser
===================================================== */

onAuthStateChanged(auth, async (user) => {

  console.log(
    "🔐 Firebase auth state changed:",
    user ? user.email : "No user"
  );


  /* ================================================
     USER NOT LOGGED IN
  ================================================= */

  if (!user) {

    /*
      Firebase has finished checking authentication.

      Redirect only when there is actually no user.
    */

    window.location.href = "/login.html";

    return;

  }


  /* ================================================
     USER LOGGED IN
  ================================================= */

  currentUser = user;


  console.log(
    "✅ Referral page authenticated:",
    user.email
  );


  /*
    Prevent duplicate API calls if Firebase
    auth state changes again.
  */

  if (!referralDataLoaded) {

    referralDataLoaded = true;

    await loadReferralData();

  }

});


/* =====================================================
   GET FIREBASE TOKEN
===================================================== */

async function getFirebaseToken(
  forceRefresh = false
) {

  if (!currentUser) {

    throw new Error(
      "User is not logged in"
    );

  }


  return await currentUser.getIdToken(
    forceRefresh
  );

}


/* =====================================================
   LOAD REFERRAL DATA
===================================================== */

async function loadReferralData() {

  try {

    console.log(
      "📡 Loading referral information..."
    );


    /* ================================================
       FIRST REQUEST
    ================================================= */

    let token =
      await getFirebaseToken(false);


    let response =
      await fetch(
        "/api/referral/my-referral",
        {
          method: "GET",

          headers: {

            "Authorization":
              `Bearer ${token}`,

            "Content-Type":
              "application/json"

          }

        }
      );


    /* ================================================
       IF TOKEN REJECTED
       REFRESH ONLY ONCE
    ================================================= */

    if (response.status === 401) {

      console.warn(
        "⚠️ Token rejected. Refreshing Firebase token..."
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
                `Bearer ${token}`,

              "Content-Type":
                "application/json"

            }

          }
        );

    }


    /* ================================================
       FINAL ERROR
       IMPORTANT:
       DO NOT LOG USER OUT AUTOMATICALLY
    ================================================= */

    if (!response.ok) {

      let errorData = {};

      try {

        errorData =
          await response.json();

      } catch (error) {

        console.error(
          "Could not read error response"
        );

      }


      console.error(
        "❌ Referral API error:",
        response.status,
        errorData
      );


      showReferralError(
        errorData.message ||
        "Unable to load referral information."
      );


      return;

    }


    /* ================================================
       SUCCESS
    ================================================= */

    const data =
      await response.json();


    console.log(
      "✅ Referral data loaded:",
      data
    );


    updateReferralUI(data);


  } catch (error) {

    console.error(
      "❌ Error loading referral data:",
      error
    );


    showReferralError(
      "Unable to load referral information. Please try again."
    );

  }

}


/* =====================================================
   UPDATE REFERRAL UI
===================================================== */

function updateReferralUI(data) {

  /*
    Referral link
  */

  const referralLinkInput =
    document.getElementById(
      "referralLink"
    );


  if (
    referralLinkInput &&
    data.referralLink
  ) {

    referralLinkInput.value =
      data.referralLink;

  }


  /*
    Referral code
  */

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


  /*
    Total referrals
  */

  const referralCount =
    document.getElementById(
      "referralCount"
    );


  if (referralCount) {

    referralCount.textContent =
      data.referralCount || 0;

  }


  /*
    Total rewards
  */

  const rewardCount =
    document.getElementById(
      "rewardCount"
    );


  if (rewardCount) {

    rewardCount.textContent =
      data.referralRewards || 0;

  }


  /*
    Optional loading text
  */

  const referralStatus =
    document.getElementById(
      "referralStatus"
    );


  if (referralStatus) {

    referralStatus.textContent = "";

  }

}


/* =====================================================
   SHOW ERROR
===================================================== */

function showReferralError(message) {

  const referralStatus =
    document.getElementById(
      "referralStatus"
    );


  if (referralStatus) {

    referralStatus.textContent =
      message;

    referralStatus.style.color =
      "#dc2626";

  }


  console.error(
    "Referral Error:",
    message
  );

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
        "❌ referralLink input not found"
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


      console.log(
        "📋 Referral link copied"
      );


    } catch (error) {

      console.error(
        "❌ Copy failed:",
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

      /*
        User closing the share dialog
        is not a real error.
      */

      if (
        error.name !== "AbortError"
      ) {

        console.error(
          "Share error:",
          error
        );

      }

    }

  };
