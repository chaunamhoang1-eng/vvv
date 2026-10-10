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
  let data;

  try {
    data = await response.json();
  } catch {
    const error = new Error("Invalid response from HalusAI");
    error.status = response.status;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(
      data?.error?.message || "HalusAI request failed"
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

// Uses the existing firebaseAuth middleware in server.js.
// firebaseAuth attaches the authenticated user to req.firebaseUser.
function requireLogin(req, res, next) {
  if (!req.firebaseUser?.uid) {
    return res.status(401).json({
      error: "Login required"
    });
  }

  next();
}

router.post("/", requireLogin, async (req, res) => {
  try {
    const { text, tone } = req.body || {};

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        error: "Please provide text to humanize"
      });
    }

    const trimmedText = text.trim();
    const wordCount = trimmedText.split(/\s+/).length;

    if (wordCount < 50) {
      return res.status(400).json({
        error: "Minimum 50 words required"
      });
    }

    // Prevent unexpectedly large requests.
    if (trimmedText.length > 100000) {
      return res.status(400).json({
        error: "Text exceeds the maximum allowed length"
      });
    }

    // Map existing UI options to HalusAI request fields.
    const model = tone === "lite" ? "lite" : "ultra";
    const plainer = tone === "simple";

    const reference = crypto.randomUUID();

    const payload = {
      text: trimmedText,
      model,
      plainer,
      reference
    };

    // Include the webhook URL only when configured.
    if (process.env.HALUS_WEBHOOK_URL) {
      payload.webhook_url = process.env.HALUS_WEBHOOK_URL;
    }

    const response = await fetch(
      `${HALUS_URL}/v1/humanize`,
      {
        method: "POST",
        headers: {
          ...getHeaders(),
          "Idempotency-Key": reference
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000)
      }
    );

    const job = await readHalusResponse(response);

    if (job.id === undefined || job.id === null) {
      console.error("HalusAI response did not include a job ID");

      return res.status(502).json({
        error: "HalusAI returned an invalid job response"
      });
    }

    // TODO before production:
    // Persist job.id, req.firebaseUser.uid, reference, status,
    // and timestamps in MongoDB.

    return res.status(202).json({
      jobId: job.id,
      status: job.status,
      wordsCharged: job.words_charged
    });
  } catch (error) {
    console.error("Humanize error:", {
      message: error.message,
      status: error.status
    });

    if (error.name === "TimeoutError" ||
        error.name === "AbortError") {
      return res.status(504).json({
        error: "HalusAI request timed out. Please check job status before retrying."
      });
    }

    if (error.message === "HALUS_API_KEY is missing") {
      return res.status(500).json({
        error: "Humanization service is not configured"
      });
    }

    return res.status(502).json({
      error: "Unable to submit humanization request"
    });
  }
});

router.get("/jobs/:id", requireLogin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        error: "Invalid job ID"
      });
    }

    // IMPORTANT:
    // Before production, find this job in your own MongoDB database
    // and verify its stored Firebase UID matches req.firebaseUser.uid.
    // Reject unknown jobs before contacting HalusAI.

    const response = await fetch(
      `${HALUS_URL}/v1/jobs/${encodeURIComponent(id)}?wait=0`,
      {
        method: "GET",
        headers: getHeaders(),
        signal: AbortSignal.timeout(15000)
      }
    );

    const job = await readHalusResponse(response);

    return res.json({
      status: job.status,
      progress: job.progress,
      text: job.result?.text ?? null,
      wordsCharged: job.words_charged,
      error: job.error?.message ?? null
    });
  } catch (error) {
    console.error("Humanize job error:", {
      message: error.message,
      status: error.status
    });

    if (error.name === "TimeoutError" ||
        error.name === "AbortError") {
      return res.status(504).json({
        error: "Timed out while retrieving the job"
      });
    }

    if (error.message === "HALUS_API_KEY is missing") {
      return res.status(500).json({
        error: "Humanization service is not configured"
      });
    }

    return res.status(502).json({
      error: "Unable to retrieve job"
    });
  }
});

export default router;
