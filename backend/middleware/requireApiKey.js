
import ApiUser from "../models/ApiUser.js";

export async function requireApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({ error: "API key required" });
  }

  const user = await ApiUser.findOne({ apiKey });

  if (!user) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  if (user.status !== "active") {
    return res.status(403).json({ error: "Account blocked" });
  }

  if (user.credits <= 0) {
    return res.status(402).json({ error: "Insufficient credits" });
  }

  req.apiUser = user;
  next();
}
