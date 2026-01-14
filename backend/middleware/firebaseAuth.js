import admin from "../utils/firebaseAdmin.js";

/**
 * Firebase Authentication Middleware
 * - Verifies Firebase ID token
 * - Attaches decoded user to req.firebaseUser
 * - SAFE for existing users (email-based) + new Firebase users
 */
export default async function firebaseAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // ❌ Missing Authorization header
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Unauthorized: Missing token"
      });
    }

    // ✅ Extract token
    const token = authHeader.split(" ")[1];

    // ✅ Verify token
    const decodedToken = await admin.auth().verifyIdToken(token);

    // ✅ Attach normalized user info
    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      emailVerified: decodedToken.email_verified === true
    };

    return next();
  } catch (error) {
    console.error("FirebaseAuth error:", error);

    return res.status(401).json({
      message: "Unauthorized: Invalid or expired token"
    });
  }
}
