import express from "express";
import crypto from "node:crypto";
import HumanizeJob from "../models/HumanizeJob.js";

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

// Firebase authentication is applied in server.js.
// firebaseAuth attaches the verified user to req.firebaseUser.
function requireLogin(req, res, next) {
  if (!req.firebaseUser?.uid) {
    return res.status(401).json({
      error: "Login required"
    });
  }

  next();
}

// Submit a humanization job.
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

    if (trimmedText.length > 100000) {
      return res.status(400).json({
        error: "Text exceeds the maximum allowed length"
      });
    }

    const model = tone === "lite" ? "lite" : "ultra";
    const plainer = tone === "simple";

    const reference = crypto.randomUUID();

    const payload = {
      text: trimmedText,
      model,
      plainer,
      reference
    };

    if (process.env.HALUS_WEBHOOK_URL) {
      payload.webhook_url = process.env.HALUS_WEBHOOK_URL;
    }

    const response = await fetch(`${HALUS_URL}/v1/humanize`, {
      method: "POST",
      headers: {
        ...getHeaders(),
        "Idempotency-Key": reference
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    });

    const job = await readHalusResponse(response);

    if (job.id === undefined || job.id === null) {
      console.error("HalusAI response missing job ID");

      return res.status(502).json({
        error: "HalusAI returned an invalid job response"
      });
    }

    // Save ownership before returning the job ID.
    await HumanizeJob.create({
      halusJobId: String(job.id),
      firebaseUid: req.firebaseUser.uid,
      reference,
      status: job.status || "pending",
      wordsCharged: job.words_charged ?? 0
    });

    return res.status(202).json({
      jobId: String(job.id),
      status: job.status || "pending",
      wordsCharged: job.words_charged ?? 0
    });
  } catch (error) {
    console.error("Humanize submission error:", {
      message: error.message,
      status: error.status
    });

    if (
      error.name === "TimeoutError" ||
      error.name === "AbortError"
    ) {
      return res.status(504).json({
        error: "Humanization request timed out. Check job status before retrying."
      });
    }

    if (error.message === "HALUS_API_KEY is missing") {
      return res.status(500).json({
        error: "Humanization service is not configured"
      });
    }

    // A duplicate job ID or MongoDB failure can happen after
    // HalusAI has already accepted the job. Do not automatically
    // submit a second job here.
    return res.status(502).json({
      error: "Unable to save or submit the humanization job"
    });
  }
});

// Retrieve a job only if it belongs to the logged-in user.
router.get("/jobs/:id", requireLogin, async (req, res) => {
  try {
    const id = req.params.id;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        error: "Invalid job ID"
      });
    }

    // Verify ownership BEFORE contacting HalusAI.
    const savedJob = await HumanizeJob.findOne({
      halusJobId: id,
      firebaseUid: req.firebaseUser.uid
    });

    if (!savedJob) {
      return res.status(404).json({
        error: "Job not found"
      });
    }

    const response = await fetch(
      `${HALUS_URL}/v1/jobs/${encodeURIComponent(id)}?wait=0`,
      {
        method: "GET",
        headers: getHeaders(),
        signal: AbortSignal.timeout(15000)
      }
    );

    const job = await readHalusResponse(response);

    // Update the saved record with the latest provider status.
    savedJob.status = job.status || savedJob.status;

    savedJob.wordsCharged =
      job.words_charged ?? savedJob.wordsCharged;

    if (job.result?.text != null) {
      savedJob.resultText = job.result.text;
    }

    if (job.error?.message) {
      savedJob.errorMessage = job.error.message;
    }

    await savedJob.save();

    return res.json({
      jobId: savedJob.halusJobId,
      status: savedJob.status,
      progress: job.progress ?? null,
      text: savedJob.resultText,
      wordsCharged: savedJob.wordsCharged,
      error: savedJob.errorMessage
    });
  } catch (error) {
    console.error("Humanize job retrieval error:", {
      message: error.message,
      status: error.status
    });

    if (
      error.name === "TimeoutError" ||
      error.name === "AbortError"
    ) {
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
