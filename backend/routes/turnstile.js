import express from "express";

const router = express.Router();

router.post("/verify-turnstile", async (req, res) => {
  try {

    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Missing Turnstile token"
      });
    }

    if (!process.env.TURNSTILE_SECRET_KEY) {
      console.error(
        "❌ TURNSTILE_SECRET_KEY is missing"
      );

      return res.status(500).json({
        success: false,
        error: "Turnstile is not configured"
      });
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          secret:
            process.env.TURNSTILE_SECRET_KEY,

          response: token,

          remoteip:
            req.ip
        })
      }
    );

    const result =
      await response.json();

    console.log(
      "Turnstile verification:",
      result.success
    );

    if (!result.success) {

      console.error(
        "❌ Turnstile failed:",
        result["error-codes"]
      );

      return res.status(403).json({
        success: false,
        error:
          "Turnstile verification failed"
      });
    }

    return res.json({
      success: true
    });

  } catch (error) {

    console.error(
      "🔥 Turnstile verification error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "Turnstile verification failed"
    });

  }
});

export default router;
