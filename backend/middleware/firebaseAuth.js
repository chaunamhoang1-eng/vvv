import admin from "firebase-admin";

/**
 * Firebase Authentication Middleware
 * - Verifies Firebase ID token
 * - Attaches decoded user to req.firebaseUser
 */
export default async function firebaseAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // ❌ No Authorization header
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Unauthorized: Missing token"
      });
    }

    // ✅ Extract token
    const token = authHeader.split(" ")[1];

    // ✅ Verify token with Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(token);

    // ✅ Attach user info to request
    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified
    };

    next(); // allow request to continue
  } catch (error) {
    console.error("FirebaseAuth error:", error.message);

    return res.status(403).json({
      message: "Unauthorized: Invalid or expired token"
    });
  }
}
