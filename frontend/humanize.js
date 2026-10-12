

let humanizeInProgress = false;

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

// ================= CONFIGURATION =================

const MIN_WORDS = 10;
const MAX_WORDS = 5000;
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40;

// ================= WORDS & CREDITS =================

function countWords(text) {
  const trimmed = String(text || "").trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

function calculateCredits(wordCount) {
  return wordCount > 0 ? Math.ceil(wordCount / 1000) : 0;
}

// ================= UI HELPERS =================

function getElement(id) {
  return document.getElementById(id);
}

function showMessage(message) {
  const element = getElement("creditMessage");

  if (element) {
    element.textContent = message || "";
  }
}

function showActionMessage(message) {
  const element = getElement("outputActionMessage");

  if (element) {
    element.textContent = message || "";
  }
}

function setResultMessage(message) {
  const resultBox = getElement("resultBox");

  if (!resultBox) return;

  resultBox.replaceChildren();
  resultBox.textContent = message;
}

function updateCreditDisplay(credits) {
  const element = getElement("humanizerCredits");

  if (element) {
    element.textContent = String(credits);
  }

  updateHumanizeButton();
}

function setHumanizeButtonState({
  disabled,
  text
}) {
  const button = getElement("humanizeButton");

  if (!button) return;

  button.disabled = disabled;
  button.textContent = text;
}

function updateHumanizeButton() {
  const button = getElement("humanizeButton");

  if (!button || humanizeInProgress) return;

  const input = getElement("inputText");
  const balanceElement = getElement("humanizerCredits");

  if (!input || !balanceElement) return;

  const balanceText = balanceElement.textContent.trim();
  const balance = Number(balanceText);
  const words = countWords(input.value);
  const creditsRequired = calculateCredits(words);

  if (!Number.isFinite(balance) || balanceText === "") {
    setHumanizeButtonState({
      disabled: true,
      text: "Checking Credits..."
    });
    return;
  }

  if (words < MIN_WORDS) {
    setHumanizeButtonState({
      disabled: true,
      text: "Humanize Text"
    });
    return;
  }

  if (words > MAX_WORDS) {
    setHumanizeButtonState({
      disabled: true,
      text: "Maximum 5,000 Words"
    });
    return;
  }

  if (balance < creditsRequired) {
    setHumanizeButtonState({
      disabled: true,
      text: "Buy Humanizer Credits"
    });
    return;
  }

  setHumanizeButtonState({
    disabled: false,
    text: "Humanize Text"
  });
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

    const finish = (callback, value) => {
      if (settled) return;

      settled = true;

      if (unsubscribe) {
        unsubscribe();
      }

      callback(value);
    };

    import(
      "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js"
    )
      .then(({ onAuthStateChanged }) => {
        unsubscribe = onAuthStateChanged(
          auth,
          user => finish(resolve, user),
          error => finish(reject, error)
        );
      })
      .catch(error => finish(reject, error));
  });
}

async function getAuthToken() {
  const user = await waitForFirebaseUser();

  if (!user) {
    throw new Error("Please log in to use the Humanizer.");
  }

  return user.getIdToken();
}

// ================= API HELPER =================

async function apiFetch(url, options = {}) {
  const token = await getAuthToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    },
    credentials: "same-origin"
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `The server returned an invalid response (${response.status}).`
    );
  }

  if (!response.ok) {
    const error = new Error(
      data.error || data.message || `Request failed (${response.status}).`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

// ================= LOAD CREDIT BALANCE =================

async function loadHumanizerCredits() {
  const creditElement = getElement("humanizerCredits");

  try {
    if (creditElement && creditElement.textContent.trim() === "") {
      creditElement.textContent = "Loading...";
    }

    const data = await apiFetch("/api/humanize/credits", {
      method: "GET"
    });

    const credits = Number(data.humanizerCredits);

    if (!Number.isFinite(credits) || credits < 0) {
      throw new Error("Invalid Humanizer credit balance.");
    }

    updateCreditDisplay(credits);
    updateCreditPreview();

    return credits;
  } catch (error) {
    console.error("Humanizer credit loading failed:", error);

    if (creditElement) {
      creditElement.textContent = "Unavailable";
    }

    setHumanizeButtonState({
      disabled: true,
      text: "Credits Unavailable"
    });

    showMessage(
      error.message || "Unable to load Humanizer credits. Please try again."
    );

    return null;
  }
}

// ================= LIVE COST PREVIEW =================

function updateCreditPreview() {
  const input = getElement("inputText");
  const wordCountElement = getElement("wordCount");
  const creditsElement = getElement("creditsRequired");

  if (!input) return;

  const words = countWords(input.value);
  const credits = calculateCredits(words);

  if (wordCountElement) {
    wordCountElement.textContent = words.toLocaleString();
  }

  if (creditsElement) {
    creditsElement.textContent =
      words > MAX_WORDS
        ? "Maximum exceeded"
        : `${credits} credit${credits === 1 ? "" : "s"}`;
  }

  updateHumanizeButton();

  // Do not overwrite job status messages while processing.
  if (humanizeInProgress) return;

  if (words === 0) {
    showMessage("");
  } else if (words < MIN_WORDS) {
    showMessage(`Enter at least ${MIN_WORDS} words to continue.`);
  } else if (words > MAX_WORDS) {
    showMessage(`Maximum ${MAX_WORDS.toLocaleString()} words per request.`);
  } else {
    const balanceElement = getElement("humanizerCredits");
    const balance = Number(balanceElement?.textContent);

    if (
      balanceElement &&
      Number.isFinite(balance) &&
      balanceElement.textContent.trim() !== "" &&
      balance < credits
    ) {
      showMessage(
        `This text requires ${credits} credits, but your balance is ${balance}.`
      );
    } else {
      showMessage(
        `${words.toLocaleString()} words · ${credits} Humanizer ` +
        `credit${credits === 1 ? "" : "s"} required`
      );
    }
  }
}

// ================= OUTPUT RENDERING =================

function renderHumanizedOutput(text, wordCount, creditsCharged) {
  const resultBox = getElement("resultBox");

  if (!resultBox) return;

  resultBox.replaceChildren();

  const heading = document.createElement("h3");
  heading.className = "output-heading";
  heading.textContent = "Humanized Output:";

  // The .humanized-text class lets the HTML Copy/Download controls
  // select only the generated text, not status messages or usage details.
  const output = document.createElement("div");
  output.className = "humanized-text";
  output.style.whiteSpace = "pre-wrap";
  output.style.overflowWrap = "anywhere";
  output.style.lineHeight = "1.8";
  output.textContent = text;

  const usage = document.createElement("p");
  usage.className = "output-usage";
  usage.textContent =
    `Words submitted: ${Number(wordCount).toLocaleString()} · ` +
    `Credits charged: ${creditsCharged}`;

  resultBox.append(heading, output, usage);

  showActionMessage("");
}

// ================= HUMANIZE =================

async function humanizeText() {
  if (humanizeInProgress) return;

  const input = getElement("inputText");
  const toneSelect = getElement("toneSelect");
  const button = getElement("humanizeButton");

  if (!input || !toneSelect || !button) {
    console.error("Humanizer UI elements are missing.");
    return;
  }

  const text = input.value.trim();
  const tone = toneSelect.value;
  const wordCount = countWords(text);

  if (!text) {
    showMessage("Please enter text to humanize.");
    return;
  }

  if (wordCount < MIN_WORDS) {
    showMessage(`Text must contain at least ${MIN_WORDS} words.`);
    return;
  }

  if (wordCount > MAX_WORDS) {
    showMessage(
      `Maximum ${MAX_WORDS.toLocaleString()} words are allowed per request.`
    );
    return;
  }

  const estimatedCredits = calculateCredits(wordCount);

  humanizeInProgress = true;

  button.disabled = true;
  button.textContent = "Submitting...";

  showActionMessage("");
  setResultMessage("Checking your login and credit balance...");

  try {
    // Refresh the balance immediately before submitting.
    const balanceData = await apiFetch("/api/humanize/credits", {
      method: "GET"
    });

    const balance = Number(balanceData.humanizerCredits);

    if (!Number.isFinite(balance) || balance < 0) {
      throw new Error("The server returned an invalid credit balance.");
    }

    updateCreditDisplay(balance);

    if (balance < estimatedCredits) {
      showMessage(
        `This request needs ${estimatedCredits} credits, ` +
        `but you have ${balance}. Please purchase more credits.`
      );

      setResultMessage("Insufficient Humanizer credits.");
      return;
    }

    setResultMessage(
      `Submitting ${wordCount.toLocaleString()} words ` +
      `(${estimatedCredits} credits)...`
    );

    const data = await apiFetch("/api/humanize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        tone
      })
    });

    if (data.jobId == null) {
      throw new Error("The server did not return a job ID.");
    }

    const jobId = data.jobId;

    if (data.humanizerCredits != null) {
      updateCreditDisplay(Number(data.humanizerCredits));
    } else {
      await loadHumanizerCredits();
    }

    const charged = Number(data.creditsCharged ?? estimatedCredits);

    showMessage(
      `Job accepted. ${charged} credits charged.`
    );

    setResultMessage("Humanizing your text. Please wait...");

    // Poll the existing job endpoint.
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);

      const job = await apiFetch(
        `/api/humanize/jobs/${encodeURIComponent(jobId)}`,
        { method: "GET" }
      );

      const status = String(job.status || "").toLowerCase();

      if (
        ["done", "completed", "succeeded", "success"].includes(status)
      ) {
        // Support the existing backend's result field.
        const outputText =
          typeof job.text === "string"
            ? job.text
            : typeof job.resultText === "string"
              ? job.resultText
              : "";

        if (!outputText) {
          setResultMessage(
            "The job completed, but no output text was returned."
          );

          showMessage(
            "Please check the job status before submitting again."
          );

          return;
        }

        renderHumanizedOutput(
          outputText,
          job.wordCount ?? wordCount,
          job.creditsCharged ?? data.creditsCharged ?? estimatedCredits
        );

        showMessage("Humanization completed successfully.");

        // Refresh the current credit balance.
        await loadHumanizerCredits();

        return;
      }

      if (
        ["failed", "error", "cancelled", "canceled"].includes(status)
      ) {
        throw new Error(
          job.error ||
          job.errorMessage ||
          "Humanization failed."
        );
      }

      const percent = job.progress?.percent;

      setResultMessage(
        typeof percent === "number"
          ? `Processing... ${percent}%`
          : "Humanizing your text. Please wait..."
      );
    }

    setResultMessage(
      "Processing is taking longer than expected. " +
      "Check the job status before submitting again."
    );
  } catch (error) {
    console.error("Humanizer error:", error);

    if (error.status === 402 && error.data?.humanizerCredits != null) {
      updateCreditDisplay(Number(error.data.humanizerCredits));
    }

    setResultMessage(`Error: ${error.message}`);

    showMessage(
      error.message || "An unexpected error occurred."
    );
  } finally {
    humanizeInProgress = false;

    // Reload balance and enable the button only if sufficient credits remain.
    const credits = await loadHumanizerCredits();

    if (credits === null) {
      setHumanizeButtonState({
        disabled: true,
        text: "Credits Unavailable"
      });
    } else {
      updateCreditPreview();
    }
  }
}

// ================= INITIALIZE =================

window.humanizeText = humanizeText;
window.loadHumanizerCredits = loadHumanizerCredits;
window.updateCreditPreview = updateCreditPreview;
window.getHumanizerWordCount = countWords;
window.getHumanizerCreditCost = calculateCredits;

document.addEventListener("DOMContentLoaded", () => {
  const input = getElement("inputText");

  if (input) {
    input.addEventListener("input", updateCreditPreview);
  }

  const refreshButton = getElement("refreshCreditsButton");

  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      refreshButton.disabled = true;

      try {
        await loadHumanizerCredits();
      } finally {
        refreshButton.disabled = false;
      }
    });
  }

  updateCreditPreview();
  loadHumanizerCredits();
});
