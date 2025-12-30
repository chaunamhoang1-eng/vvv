import jwt from "jsonwebtoken";

export default function adminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Attach admin info to request
    req.admin = {
      id: decoded.id,
      username: decoded.username
    };

    next();
  } catch (err) {
    console.error("ADMIN AUTH ERROR:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
