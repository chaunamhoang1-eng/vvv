import { initializeApp, getApps } from
"https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from
"https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";


const firebaseConfig = {

    apiKey: "AIzaSyAbvVgUW6H3sJBY3Sng7JSCzyBFN1PxrnQ",

  authDomain: "login-98c26.firebaseapp.com",

  projectId: "login-98c26",

  storageBucket: "login-98c26.firebasestorage.app",

  messagingSenderId: "199892612420",

  appId: "1:199892612420:web:db0aeb5bd145f335955311"

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
