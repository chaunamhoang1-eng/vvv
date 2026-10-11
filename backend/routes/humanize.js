```js
import express from "express";
import crypto from "node:crypto";
import HumanizeJob from "../models/HumanizeJob.js";
import User from "../models/user.js";

const router = express.Router();

const HALUS_URL = "https://halus.app";
const HALUS_MODEL = "lite";

const SUBMIT_TIMEOUT_MS = 60000;
const STATUS_TIMEOUT_MS = 15000;

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
  const raw = await response.text();

  let data;

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    const error = new Error(
      `Halus returned non-JSON (HTTP ${response.status})`
    );
    error.status = response.status;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(
      data?.error?.message ||
      data?.message ||
      `Halus request failed (HTTP ${response.status})`
    );

    error.status = response.status;
    error.providerResponse = data;
    throw error;
  }

  return data;
}

function requireLogin(req, res, next) {
  if (!req.firebaseUser?.uid) {
    return res.status(401).json({
      error: "Login required"
    });
  }

  next();
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function handleError(res, error, operation) {
  console.error(`${operation} failed:`, {
    message: error.message,
    name: error.name,
    status: error.status,
    stack: error.stack
  });

  if (error.message === "HALUS_API_KEY is missing") {
    return res.status(500).json({
      error: "Humanization service is not configured"
    });
  }

  if (
    error.name === "TimeoutError" ||
    error.name === "AbortError"
  ) {
    return res.status(504).json({
      error:
        "The request timed out. Check job status or contact support before retrying."
    });
  }

  return res.status(error.status === 400 ? 400 : 502).json({
    error: "Unable to complete the humanization request"
  });
}

// Release a reserved credit after a definitive provider rejection.
async function refundHumanizerCredit(firebaseUid, reference) {
  const result = await User.updateOne(
    { firebaseUid },
    { $inc: { humanizerCredits: 1 } }
  );

  if (result.modifiedCount !== 1) {
    console.error("Humanizer credit refund failed:", {
      firebaseUid,
      reference
    });

    throw new Error("Humanizer credit refund failed");
  }

  console.log("Humanizer credit refunded:", reference);
}

// Submit a humanization job.
router.post("/", requireLogin, async (req, res) => {
  const firebaseUid = req.firebaseUser.uid;
  let creditReserved = false;
  let reference;

  try {
    const { text, tone } = req.body || {};

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        error: "Please provide text to humanize"
      });
    }

    const trimmedText = text.trim();
    const wordCount = countWords(trimmedText);

    if (wordCount < 10) {
      return res.status(400).json({
        error: "Please provide at least 10 words"
      });
    }

    if (wordCount > 5000) {
      return res.status(400).json({
        error: "Maximum 5,000 words are allowed per request"
      });
    }

    // Ensure the user has a registered account.
    const account = await User.findOne({ firebaseUid })
      .select("_id humanizerCredits")
      .lean();

    if (!account) {
      return res.status(404).json({
        error: "User account not found"
      });
    }

    // Atomically reserve one Humanizer credit.
    // This never modifies the normal plagiarism credits.
    const updatedUser = await User.findOneAndUpdate(
      {
        firebaseUid,
        humanizerCredits: { $gte: 1 }
      },
      {
        $inc: { humanizerCredits: -1 }
      },
      {
        new: true
      }
    );

    if (!updatedUser) {
      return res.status(402).json({
        error: "Insufficient Humanizer credits",
        humanizerCredits: account.humanizerCredits ?? 0
      });
    }

    creditReserved = true;
    reference = crypto.randomUUID();

    const payload = {
      text: trimmedText,
      model: HALUS_MODEL,
      plainer: tone === "simple",
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
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS)
    });

    let job;

    try {
      job = await readHalusResponse(response);
    } catch (providerError) {
      // Refund only on a definitive client-side rejection.
      // A timeout, server error, or ambiguous response must be
      // reconciled before refunding to avoid double use.
      const definitiveRejection =
        providerError.status >= 400 &&
        providerError.status < 500 &&
        providerError.status !== 408 &&
        providerError.status !== 409;

      if (definitiveRejection) {
        await refundHumanizerCredit(firebaseUid, reference);
        creditReserved = false;
      }

      throw providerError;
    }

    if (job.id === undefined || job.id === null) {
      // The provider may have accepted the job. Keep the credit
      // reserved until this request can be reconciled.
      console.error("Halus response missing job ID:", { reference });

      return res.status(502).json({
        error:
          "The provider response needs verification. Contact support before retrying.",
        reference
      });
    }

    try {
      await HumanizeJob.create({
        halusJobId: String(job.id),
        firebaseUid,
        reference,
        status: job.status || "pending",
        wordsCharged: job.words_charged ?? 0
      });
    } catch (dbError) {
      // The provider accepted the job. Do not refund automatically.
      // Keep the reference in logs for support/reconciliation.
      console.error("Could not save accepted Humanizer job:", {
        message: dbError.message,
        halusJobId: String(job.id),
        reference
      });

      return res.status(500).json({
        error:
          "The provider accepted the job but saving it failed. Contact support before retrying.",
        reference
      });
    }

    return res.status(202).json({
      jobId: String(job.id),
      status: job.status || "pending",
      wordsCharged: job.words_charged ?? 0,
      reference,
      // Credit balance after the reservation.
      humanizerCredits: updatedUser.humanizerCredits
    });
  } catch (error) {
    // If the provider call timed out or failed ambiguously, leave
    // the reserved credit in place until the outcome is verified.
    // If the provider definitively rejected it, the refund above
    // has already been attempted.
    return handleError(res, error, "Humanization submission");
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
        signal: AbortSignal.timeout(STATUS_TIMEOUT_MS)
      }
    );

    const job = await readHalusResponse(response);

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
    return handleError(res, error, "Humanization job retrieval");
  }
});

export default router;
```
