
import express from "express";
import crypto from "node:crypto";
import HumanizeJob from "../models/HumanizeJob.js";
import User from "../models/user.js";

const router = express.Router();

const HALUS_URL = "https://halus.app";
const HALUS_MODEL = "lite";

const SUBMIT_TIMEOUT_MS = 60000;
const STATUS_TIMEOUT_MS = 15000;

// ================= HALUS HELPERS =================

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
      `Halus returned a non-JSON response (HTTP ${response.status})`
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

// ================= AUTHENTICATION =================

function requireLogin(req, res, next) {
  if (!req.firebaseUser?.uid) {
    return res.status(401).json({
      error: "Login required"
    });
  }

  next();
}

// ================= WORD / CREDIT HELPERS =================

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Every started block of 1,000 words costs one credit.
function calculateCredits(wordCount) {
  return Math.ceil(wordCount / 1000);
}

// ================= ERROR HANDLER =================

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

  return res.status(
    error.status >= 400 && error.status < 500 ? error.status : 502
  ).json({
    error: "Unable to complete the humanization request"
  });
}

// ================= CREDIT REFUND =================

// Refund only after a definitive provider rejection.
// Ambiguous outcomes must be reconciled before refunding.
async function refundHumanizerCredits(
  firebaseUid,
  reference,
  creditsToRefund
) {
  const result = await User.updateOne(
    { firebaseUid },
    {
      $inc: {
        humanizerCredits: creditsToRefund
      }
    }
  );

  if (result.modifiedCount !== 1) {
    console.error("Humanizer credit refund failed:", {
      firebaseUid,
      reference,
      creditsToRefund
    });

    throw new Error("Humanizer credit refund failed");
  }

  console.log(
    `Refunded ${creditsToRefund} Humanizer credits for ${reference}`
  );
}

// ================= CREDIT BALANCE =================

// GET /api/humanize/credits
router.get("/credits", requireLogin, async (req, res) => {
  try {
    const user = await User.findOne({
      firebaseUid: req.firebaseUser.uid
    })
      .select("humanizerCredits")
      .lean();

    if (!user) {
      return res.status(404).json({
        error: "User account not found"
      });
    }

    return res.json({
      humanizerCredits: user.humanizerCredits ?? 0
    });
  } catch (error) {
    console.error("Humanizer balance error:", error);

    return res.status(500).json({
      error: "Unable to load Humanizer credits"
    });
  }
});

// ================= SUBMIT HUMANIZATION JOB =================

// POST /api/humanize
router.post("/", requireLogin, async (req, res) => {
  const firebaseUid = req.firebaseUser.uid;

  let reference;
  let creditsReserved = false;
  let creditsRequired = 0;

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

    creditsRequired = calculateCredits(wordCount);

    // Ensure the account exists.
    const account = await User.findOne({
      firebaseUid
    })
      .select("humanizerCredits")
      .lean();

    if (!account) {
      return res.status(404).json({
        error: "User account not found"
      });
    }

    // Atomically deduct the exact number of Humanizer credits.
    // The normal plagiarism `credits` field is never modified.
    const updatedUser = await User.findOneAndUpdate(
      {
        firebaseUid,
        humanizerCredits: {
          $gte: creditsRequired
        }
      },
      {
        $inc: {
          humanizerCredits: -creditsRequired
        }
      },
      {
        new: true
      }
    );

    if (!updatedUser) {
      return res.status(402).json({
        error: "Insufficient Humanizer credits",
        wordCount,
        creditsRequired,
        humanizerCredits: account.humanizerCredits ?? 0
      });
    }

    creditsReserved = true;
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

    // Submit to Halus using a stable idempotency key.
    let response;

    try {
      response = await fetch(`${HALUS_URL}/v1/humanize`, {
        method: "POST",
        headers: {
          ...getHeaders(),
          "Idempotency-Key": reference
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS)
      });
    } catch (networkError) {
      // A network failure or timeout does not prove the provider
      // rejected the job. Keep credits reserved pending reconciliation.
      console.error("Ambiguous Halus submission result:", {
        reference,
        message: networkError.message
      });

      return res.status(504).json({
        error:
          "The submission outcome is uncertain. Contact support before retrying.",
        reference
      });
    }

    let job;

    try {
      job = await readHalusResponse(response);
    } catch (providerError) {
      const definitiveRejection =
        providerError.status >= 400 &&
        providerError.status < 500 &&
        providerError.status !== 408 &&
        providerError.status !== 409 &&
        providerError.status !== 429;

      if (definitiveRejection) {
        await refundHumanizerCredits(
          firebaseUid,
          reference,
          creditsRequired
        );

        creditsReserved = false;
      }

      throw providerError;
    }

    if (job.id === undefined || job.id === null) {
      // The provider may have accepted the request.
      // Do not refund automatically without reconciliation.
      console.error("Halus response missing job ID:", {
        reference,
        responseKeys: Object.keys(job || {})
      });

      return res.status(502).json({
        error:
          "The provider response needs verification. Contact support before retrying.",
        reference
      });
    }

    // Save the accepted job.
    try {
      await HumanizeJob.create({
        halusJobId: String(job.id),
        firebaseUid,
        reference,
        status: job.status || "pending",
        wordsCharged: job.words_charged ?? 0,
        wordCount,
        creditsCharged: creditsRequired
      });
    } catch (dbError) {
      // Provider accepted the job. Do not refund automatically.
      // Keep the reference for manual reconciliation.
      console.error("Could not save accepted Humanizer job:", {
        message: dbError.message,
        halusJobId: String(job.id),
        reference,
        creditsCharged: creditsRequired
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
      wordCount,
      creditsCharged: creditsRequired,
      wordsCharged: job.words_charged ?? 0,
      reference,
      humanizerCredits: updatedUser.humanizerCredits
    });
  } catch (error) {
    // Prevent an automatic refund for uncertain outcomes.
    // A definitive rejection is refunded above.
    console.error("Humanization submission error:", {
      reference,
      creditsRequired,
      creditsReserved,
      message: error.message
    });

    return handleError(res, error, "Humanization submission");
  }
});

// ================= RETRIEVE JOB STATUS =================

// GET /api/humanize/jobs/:id
router.get("/jobs/:id", requireLogin, async (req, res) => {
  try {
    const id = req.params.id;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        error: "Invalid job ID"
      });
    }

    // Check ownership before contacting Halus.
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
      wordCount: savedJob.wordCount,
      creditsCharged: savedJob.creditsCharged,
      wordsCharged: savedJob.wordsCharged,
      error: savedJob.errorMessage
    });
  } catch (error) {
    return handleError(res, error, "Humanization job retrieval");
  }
});

export default router;
