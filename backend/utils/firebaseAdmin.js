import admin from "firebase-admin";
import fs from "fs";

if (!admin.apps.length) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccountPath) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT env variable is missing");
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf8")
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;

