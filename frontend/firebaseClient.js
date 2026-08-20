import { initializeApp, getApps } from
"https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from
"https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";


const firebaseConfig = {

  apiKey: "YOUR_API_KEY",

  authDomain: "YOUR_AUTH_DOMAIN",

  projectId: "YOUR_PROJECT_ID",

  storageBucket: "YOUR_STORAGE_BUCKET",

  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",

  appId: "YOUR_APP_ID"

};


/* Prevent Firebase from initializing twice */

const app =
  getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig);


const auth =
  getAuth(app);


/* Keep login after changing pages */

setPersistence(
  auth,
  browserLocalPersistence
).catch((error) => {

  console.error(
    "Firebase persistence error:",
    error
  );

});


export {
  app,
  auth
};
