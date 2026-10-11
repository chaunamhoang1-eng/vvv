
let humanizeInProgress = false;

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function calculateCredits(wordCount) {
  return Math.ceil(wordCount / 1000);
}

// ================= UI HELPERS =================

function showMessage(message) {
  const element = document.getElementById("creditMessage");

  if (element) {
    element.textContent = message;
  }
}

function updateCreditDisplay(credits) {
  const element = document.getElementById("humanizerCredits");

  if (element) {
    element.textContent = String(credits);
  }

  const button = document.getElementById("humanizeButton");

  if (button && !humanizeInProgress) {
    button.disabled = credits <= 0;
    button.textContent =
      credits <= 0 ? "Buy Humanizer Credits" : "Humanize Text";
  }
}

// ================= FIREBASE AUTH =================

function waitForFirebaseUser() {
  return new Promise((resolve, reject) => {
    const auth = window.auth;

    if (!auth) {
      reject(new Error("Firebase Auth is not initialized."));
      return;
    }

    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }

    let unsubscribe = null;
    let settled = false;

    import("https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js")
      .then(({ onAuthStateChanged }) => {
        unsubscribe = onAuthStateChanged(
          auth,
          user => {
            if (settled) return;
            settled = true;

            if (unsubscribe) unsubscribe();

            resolve(user);
          },
          error => {
            if (settled) return;
            settled = true;

            if (unsubscribe) unsubscribe();

            reject(error);
          }
        );
      })
      .catch(error => {
        if (settled) return;
        settled = true;
        reject(error);
      });
  });
}

async function getAuthToken() {
  const user = await waitForFirebaseUser();

  if (!user) {
    throw new Error("Please log in to use the Humanizer.");
  }

  return user.getIdToken();
}

// ================= LOAD CREDIT BALANCE =================

async function loadHumanizerCredits() {
  const creditElement = document.getElementById("humanizerCredits");
  const button = document.getElementById("humanizeButton");

  try {
    if (creditElement) {
      creditElement.textContent = "Loading...";
    }

    const token = await getAuthToken();

    const response = await fetch("/api/humanize/credits", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      },
      credentials: "same-origin"
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load credits.");
    }

    const credits = Number(data.humanizerCredits);

    if (!Number.isFinite(credits) || credits < 0) {
      throw new Error("Invalid Humanizer credit balance.");
    }

    updateCreditDisplay(credits);
    showMessage("");

    return credits;
  } catch (error) {
    console.error("Humanizer credit loading failed:", error);

    if (creditElement) {
      creditElement.textContent = "Unavailable";
    }

    if (button && !humanizeInProgress) {
      button.disabled = true;
      button.textContent = "Credits Unavailable";
    }

    showMessage(error.message || "Unable to load credits.");

    return null;
  }
}

// ================= LIVE COST PREVIEW =================

function updateCreditPreview() {
  const input = document.getElementById("inputText");

  if (!input) return;

  const text = input.value.trim();
  const wordCount = text ? countWords(text) : 0;
  const credits = wordCount > 0
    ? calculateCredits(wordCount)
    : 0;

  if (wordCount === 0) {
    showMessage("Enter text to calculate the credit cost.");
    return;
  }

  if (wordCount < 10) {
    showMessage("Enter at least 10 words to continue.");
    return;
  }

  if (wordCount > 5000) {
    showMessage("Maximum 5,000 words per request.");
    return;
  }

  showMessage(
    `${wordCount.toLocaleString()} words · ${credits} Humanizer ` +
    `credit${credits === 1 ? "" : "s"} required`
  );
}

// ================= HUMANIZE =================

async function humanizeText() {
  if (humanizeInProgress) return;

  const input = document.getElementById("inputText");
  const toneSelect = document.getElementById("toneSelect");
  const resultBox = document.getElementById("resultBox");
  const button = document.getElementById("humanizeButton");

  if (!input || !toneSelect || !resultBox || !button) {
    console.error("Humanizer UI elements are missing.");
    return;
  }

  const text = input.value.trim();
  const tone = toneSelect.value;
  const wordCount = countWords(text);

  if (!text) {
    showMessage("Please enter text.");
    return;
  }

  if (wordCount < 10) {
    showMessage("Text must contain at least 10 words.");
    return;
  }

  if (wordCount > 5000) {
    showMessage("Maximum 5,000 words are allowed per request.");
    return;
  }

  const estimatedCredits = calculateCredits(wordCount);

  humanizeInProgress = true;
  button.disabled = true;
  button.textContent = "Submitting...";
  resultBox.style.display = "block";
  resultBox.textContent = "Checking your login...";

  try {
    const token = await getAuthToken();

    // Refresh the balance before submitting.
    const balanceResponse = await fetch("/api/humanize/credits", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      credentials: "same-origin"
    });

    const balanceData = await balanceResponse.json();

    if (!balanceResponse.ok) {
      throw new Error(
        balanceData.error || "Unable to check your credits."
      );
    }

    const balance = Number(balanceData.humanizerCredits ?? 0);

    updateCreditDisplay(balance);

    if (balance < estimatedCredits) {
      showMessage(
        `This request needs ${estimatedCredits} credits, ` +
        `but you have ${balance}. Please purchase more credits.`
      );

      resultBox.textContent = "Insufficient Humanizer credits.";
      return;
    }

    resultBox.textContent =
      `Submitting ${wordCount.toLocaleString()} words ` +
      `(${estimatedCredits} credits)...`;

    const response = await fetch("/api/humanize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      credentials: "same-origin",
      body: JSON.stringify({
        text,
        tone
      })
    });

    const data = await response.json();

    if (!response.ok || data.jobId == null) {
      if (response.status === 402) {
        if (data.humanizerCredits != null) {
          updateCreditDisplay(data.humanizerCredits);
        } else {
          await loadHumanizerCredits();
        }
      }

      throw new Error(data.error || data.message || "Submission failed.");
    }

    const jobId = data.jobId;

    if (data.humanizerCredits != null) {
      updateCreditDisplay(data.humanizerCredits);
    } else {
      await loadHumanizerCredits();
    }

    showMessage(
      `Job accepted. ${data.creditsCharged ?? estimatedCredits} credits charged.`
    );

    resultBox.textContent = "Humanizing your text. Please wait...";

    // Poll the existing job endpoint.
    for (let attempt = 0; attempt < 40; attempt++) {
      await sleep(3000);

      const jobResponse = await fetch(
        `/api/humanize/jobs/${encodeURIComponent(jobId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          },
          credentials: "same-origin"
        }
      );

      const job = await jobResponse.json();

      if (!jobResponse.ok) {
        throw new Error(job.error || "Could not check job status.");
      }

      const status = String(job.status || "").toLowerCase();

      if (
        ["done", "completed", "succeeded", "success"].includes(status)
      ) {
        if (typeof job.text !== "string" || !job.text) {
          resultBox.textContent =
            "The job completed, but no output text was returned.";
          return;
        }

        resultBox.replaceChildren();

        const heading = document.createElement("strong");
        heading.textContent = "Humanized Output:";

        const output = document.createElement("div");
        output.style.whiteSpace = "pre-wrap";
        output.style.marginTop = "12px";
        output.textContent = job.text;

        resultBox.append(heading, output);

        const usage = document.createElement("p");
        usage.textContent =
          `Words submitted: ${job.wordCount ?? wordCount} · ` +
          `Credits charged: ${job.creditsCharged ?? estimatedCredits}`;

        resultBox.appendChild(usage);

        // Refresh balance after job completion.
        await loadHumanizerCredits();
        return;
      }

      if (
        ["failed", "error", "cancelled", "canceled"].includes(status)
      ) {
        throw new Error(job.error || "Humanization failed.");
      }

      const percent = job.progress?.percent;

      resultBox.textContent =
        typeof percent === "number"
          ? `Processing... ${percent}%`
          : "Humanizing your text. Please wait...";
    }

    resultBox.textContent =
      "Processing is taking longer than expected. Check job status " +
      "before submitting again.";
  } catch (error) {
    console.error("Humanizer error:", error);
    resultBox.textContent = `Error: ${error.message}`;
  } finally {
    humanizeInProgress = false;
    button.disabled = true;
    button.textContent = "Checking credits...";

    // Re-enable the button only if the latest balance permits it.
    await loadHumanizerCredits();
  }
}

// ================= INITIALIZE =================

window.humanizeText = humanizeText;
window.loadHumanizerCredits = loadHumanizerCredits;

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("inputText");

  if (input) {
    input.addEventListener("input", updateCreditPreview);
  }

  loadHumanizerCredits();
});
