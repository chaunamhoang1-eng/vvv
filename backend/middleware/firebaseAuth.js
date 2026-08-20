import admin from "../utils/firebaseAdmin.js";

/**
 * Firebase Authentication Middleware
 * - Verifies Firebase ID token
 * - Attaches decoded Firebase user to req.firebaseUser
 * - Logs exact authentication errors for debugging
 */
export default async function firebaseAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    /* ==========================================
       CHECK AUTHORIZATION HEADER
    ========================================== */

    if (!authHeader) {
      console.error(
        "❌ FirebaseAuth: Authorization header missing",
        req.method,
        req.originalUrl
      );

      return res.status(401).json({
        message: "Unauthorized: Missing token",
        errorCode: "MISSING_AUTH_HEADER"
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      console.error(
        "❌ FirebaseAuth: Invalid Authorization format",
        req.method,
        req.originalUrl
      );

      return res.status(401).json({
        message: "Unauthorized: Invalid token format",
        errorCode: "INVALID_AUTH_FORMAT"
      });
    }

    /* ==========================================
       EXTRACT TOKEN
    ========================================== */

    const token = authHeader.split(" ")[1];

    if (!token) {
      console.error(
        "❌ FirebaseAuth: Token is empty",
        req.method,
        req.originalUrl
      );

      return res.status(401).json({
        message: "Unauthorized: Empty token",
        errorCode: "EMPTY_TOKEN"
      });
    }

    /* ==========================================
       VERIFY FIREBASE TOKEN
    ========================================== */

    const decodedToken =
      await admin.auth().verifyIdToken(token);

    console.log(
      "✅ Firebase token verified:",
      decodedToken.email || "No email",
      "| UID:",
      decodedToken.uid
    );

    /* ==========================================
       ATTACH USER TO REQUEST
    ========================================== */

    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      emailVerified:
        decodedToken.email_verified === true
    };

    return next();

  } catch (error) {

    console.error(
      "❌ FirebaseAuth verification failed"
    );

    console.error(
      "Request:",
      req.method,
      req.originalUrl
    );

    console.error(
      "Code:",
      error.code || "UNKNOWN"
    );

    console.error(
      "Message:",
      error.message || "Unknown error"
    );

    return res.status(401).json({
      message: "Unauthorized: Invalid or expired token",
      errorCode: error.code || "UNKNOWN_AUTH_ERROR"
    });
  }
}
