import express from "express";
import crypto from "node:crypto";

const router = express.Router();

const HALUS_URL = "https://halus.app";

function getHeaders() {
  if (!process.env.HALUS_API_KEY) {
    throw new Error("HALUS_API_KEY is missing");
  }

  return {
    Authorization: `Bearer ${process.env.HALUS_API_KEY}`,
    "Content-Type": "application/json"
  };
}

async function readHalusResponse(response) {
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data.error?.message || "HalusAI request failed"
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

// Replace with your actual authentication middleware.
// These routes must not be publicly accessible.
function requireLogin(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({
      error: "Login required"
    });
  }
  next();
}

router.post("/", requireLogin, async (req, res) => {
  try {
    const { text, tone } = req.body;

    if (typeof text !== "string" ||
        text.trim().split(/\s+/).length < 50) {
      return res.status(400).json({
        error: "Minimum 50 words required"
      });
    }

    // Your UI tone values need mapping to HalusAI.
    // HalusAI supports model and plainer, not tone.
    const model = tone === "lite" ? "lite" : "ultra";
    const plainer = tone === "simple";

    const reference = crypto.randomUUID();

    const response = await fetch(
      `${HALUS_URL}/v1/humanize`,
      {
        method: "POST",
        headers: {
          ...getHeaders(),
          "Idempotency-Key": reference
        },
        
body: JSON.stringify({
  text,
  model,
  plainer,
  reference,
  webhook_url: process.env.HALUS_WEBHOOK_URL
}),

        signal: AbortSignal.timeout(30000)
      }
    );

    const job = await readHalusResponse(response);

    // REQUIRED FOR PRODUCTION:
    // Save job.id, req.user.id and reference in MongoDB
    // before allowing users to retrieve the result.

    res.status(202).json({
      jobId: job.id,
      status: job.status,
      wordsCharged: job.words_charged
    });

  } catch (error) {
    console.error("Humanize error:", error.message);
    res.status(502).json({
      error: "Unable to submit humanization request"
    });
  }
});

router.get("/jobs/:id", requireLogin, async (req, res) => {
  try {
    const id = req.params.id;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        error: "Invalid job ID"
      });
    }

    // REQUIRED: Verify in MongoDB that this job ID
    // belongs to req.user.id before calling HalusAI.
    // Do not deploy without this ownership check.

    const response = await fetch(
      `${HALUS_URL}/v1/jobs/${id}?wait=0`,
      {
        headers: getHeaders(),
        signal: AbortSignal.timeout(15000)
      }
    );

    const job = await readHalusResponse(response);

    res.json({
      status: job.status,
      progress: job.progress,
      text: job.result?.text || null,
      wordsCharged: job.words_charged,
      error: job.error?.message || null
    });

  } catch (error) {
    console.error("Job error:", error.message);
    res.status(502).json({
      error: "Unable to retrieve job"
    });
  }
});

export default router;
