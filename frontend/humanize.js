let humanizeInProgress = false;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const MIN_WORDS = 10;
const MAX_WORDS = 5000;
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40;

function countWords(text) {
  const trimmed = String(text || "").trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

function calculateCredits(words) {
  return words > 0 ? Math.ceil(words / 1000) : 0;
}

function getElement(id) {
  return document.getElementById(id);
}

function showMessage(message) {
  const element = getElement("creditMessage");
  if (element) element.textContent = message || "";
}

function showActionMessage(message) {
  const element = getElement("outputActionMessage");
  if (element) element.textContent = message || "";
}

function setResultMessage(message) {
  const box = getElement("resultBox");
  if (!box) return;

  box.replaceChildren();
  box.textContent = message;
}

function setHumanizeButtonState(disabled, text) {
  const button = getElement("humanizeButton");
  if (!button) return;

  button.disabled = disabled;
  button.textContent = text;
}

function updateHumanizeButton() {
  const button = getElement("humanizeButton");
  const input = getElement("inputText");
  const balanceElement = getElement("humanizerCredits");

  if (!button || !input || !balanceElement || humanizeInProgress) return;

  const balanceText = balanceElement.textContent.trim();
  const balance = Number(balanceText);
  const words = countWords(input.value);
  const required = calculateCredits(words);

  if (!balanceText || !Number.isFinite(balance)) {
    setHumanizeButtonState(true, "Checking Credits...");
  } else if (words < MIN_WORDS) {
    setHumanizeButtonState(true, "Humanize Text");
  } else if (words > MAX_WORDS) {
    setHumanizeButtonState(true, "Maximum 5,000 Words");
  } else if (balance < required) {
    setHumanizeButtonState(true, "Buy Humanizer Credits");
  } else {
    setHumanizeButtonState(false, "Humanize Text");
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

    let unsubscribe;
    let settled = false;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (unsubscribe) unsubscribe();
      callback(value);
    };

    import("https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js")
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

// ================= API REQUESTS =================

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
    throw new Error(`Invalid server response (${response.status}).`);
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

// ================= CREDIT BALANCE =================

async function loadHumanizerCredits() {
  const element = getElement("humanizerCredits");

  try {
    const data = await apiFetch("/api/humanize/credits", {
      method: "GET"
    });

    const credits = Number(data.humanizerCredits);

    if (!Number.isFinite(credits) || credits < 0) {
      throw new Error("Invalid Humanizer credit balance.");
    }

    if (element) element.textContent = String(credits);

    updateCreditPreview();
    return credits;
  } catch (error) {
    console.error("[Humanizer] Credit loading failed:", error);

    if (element) element.textContent = "Unavailable";

    setHumanizeButtonState(true, "Credits Unavailable");
    showMessage(error.message || "Unable to load credits.");

    return null;
  }
}

// ================= WORD / CREDIT PREVIEW =================

function updateCreditPreview() {
  const input = getElement("inputText");
  const wordElement = getElement("wordCount");
  const costElement = getElement("creditsRequired");

  if (!input) return;

  const words = countWords(input.value);
  const credits = calculateCredits(words);

  if (wordElement) {
    wordElement.textContent = words.toLocaleString();
  }

  if (costElement) {
    costElement.textContent = words > MAX_WORDS
      ? "Maximum exceeded"
      : `${credits} credit${credits === 1 ? "" : "s"}`;
  }

  updateHumanizeButton();

  if (humanizeInProgress) return;

  if (words === 0) {
    showMessage("");
  } else if (words < MIN_WORDS) {
    showMessage(`Enter at least ${MIN_WORDS} words to continue.`);
  } else if (words > MAX_WORDS) {
    showMessage(`Maximum ${MAX_WORDS.toLocaleString()} words per request.`);
  } else {
    const balanceText = getElement("humanizerCredits")?.textContent.trim();
    const balance = Number(balanceText);

    if (balanceText && Number.isFinite(balance) && balance < credits) {
      showMessage(`This text requires ${credits} credits, but your balance is ${balance}.`);
    } else {
      showMessage(`${words.toLocaleString()} words · ${credits} Humanizer credit${credits === 1 ? "" : "s"} required`);
    }
  }
}

// ================= RENDER OUTPUT =================

function renderHumanizedOutput(text, wordCount, creditsCharged) {
  const resultBox = getElement("resultBox");
  if (!resultBox) return;

  resultBox.replaceChildren();

  const heading = document.createElement("h3");
  heading.className = "output-heading";
  heading.textContent = "Humanized Output:";

  const output = document.createElement("div");
  output.className = "humanized-text";
  output.style.whiteSpace = "pre-wrap";
  output.style.overflowWrap = "anywhere";
  output.textContent = text;

  const usage = document.createElement("p");
  usage.className = "output-usage";
  usage.textContent =
    `Words submitted: ${Number(wordCount).toLocaleString()} · Credits charged: ${creditsCharged}`;

  resultBox.append(heading, output, usage);
  showActionMessage("");

  const actions = getElement("outputActions");
  if (actions) actions.style.display = "flex";
}

// ================= HUMANIZE REQUEST =================

async function humanizeText() {
  if (humanizeInProgress) return;

  const input = getElement("inputText");
  const toneSelect = getElement("toneSelect");
  const button = getElement("humanizeButton");

  if (!input || !toneSelect || !button) {
    console.error("[Humanizer] Required UI elements are missing.");
    showMessage("Humanizer page is missing required elements.");
    return;
  }

  const text = input.value.trim();
  const tone = toneSelect.value;
  const wordCount = countWords(text);

  if (wordCount < MIN_WORDS) {
    showMessage(`Please enter at least ${MIN_WORDS} words.`);
    return;
  }

  if (wordCount > MAX_WORDS) {
    showMessage(`Maximum ${MAX_WORDS.toLocaleString()} words per request.`);
    return;
  }

  humanizeInProgress = true;
  button.disabled = true;
  button.textContent = "Submitting...";
  showActionMessage("");
  setResultMessage("Checking login and credit balance...");

  try {
    console.log("[Humanizer] Checking balance");

    const balanceData = await apiFetch("/api/humanize/credits", {
      method: "GET"
    });

    const balance = Number(balanceData.humanizerCredits);
    const estimatedCredits = calculateCredits(wordCount);

    if (!Number.isFinite(balance) || balance < 0) {
      throw new Error("The server returned an invalid credit balance.");
    }

    const balanceElement = getElement("humanizerCredits");
    if (balanceElement) balanceElement.textContent = String(balance);

    if (balance < estimatedCredits) {
      showMessage(
        `This request needs ${estimatedCredits} credits, but you have ${balance}.`
      );
      setResultMessage("Insufficient Humanizer credits.");
      return;
    }

    setResultMessage(`Submitting ${wordCount} words...`);
    console.log("[Humanizer] Sending POST /api/humanize");

    const data = await apiFetch("/api/humanize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, tone })
    });

    if (data.jobId == null) {
      throw new Error("The server did not return a job ID.");
    }

    const jobId = data.jobId;

    showMessage(
      `Job accepted. ${data.creditsCharged ?? estimatedCredits} credits charged.`
    );
    setResultMessage("Humanizing your text. Please wait...");

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);

      const job = await apiFetch(
        `/api/humanize/jobs/${encodeURIComponent(jobId)}`,
        { method: "GET" }
      );

      const status = String(job.status || "").toLowerCase();

      if (["done", "completed", "succeeded", "success"].includes(status)) {
        const outputText =
          typeof job.text === "string" ? job.text :
          typeof job.resultText === "string" ? job.resultText : "";

        if (!outputText) {
          setResultMessage("The job completed, but no output text was returned.");
          return;
        }

        renderHumanizedOutput(
          outputText,
          job.wordCount ?? wordCount,
          job.creditsCharged ?? data.creditsCharged ?? estimatedCredits
        );

        showMessage("Humanization completed successfully.");
        await loadHumanizerCredits();
        return;
      }

      if (["failed", "error", "cancelled", "canceled"].includes(status)) {
        throw new Error(job.error || job.errorMessage || "Humanization failed.");
      }

      const percent = job.progress?.percent;
      setResultMessage(
        typeof percent === "number"
          ? `Processing... ${percent}%`
          : "Humanizing your text. Please wait..."
      );
    }

    setResultMessage(
      "Processing is taking longer than expected. Check job status before submitting again."
    );
  } catch (error) {
    console.error("[Humanizer] Request failed:", error);
    setResultMessage(`Error: ${error.message}`);
    showMessage(error.message || "An unexpected error occurred.");
  } finally {
    humanizeInProgress = false;

    const credits = await loadHumanizerCredits();

    if (credits === null) {
      setHumanizeButtonState(true, "Credits Unavailable");
    } else {
      updateCreditPreview();
    }
  }
}

// ================= INITIALIZATION =================

window.humanizeText = humanizeText;
window.loadHumanizerCredits = loadHumanizerCredits;
window.updateCreditPreview = updateCreditPreview;
window.updateHumanizeButton = updateHumanizeButton;
window.getHumanizerWordCount = countWords;
window.getHumanizerCreditCost = calculateCredits;

function initializeHumanizerUI() {
  const input = getElement("inputText");
  const button = getElement("humanizeButton");
  const refreshButton = getElement("refreshCreditsButton");

  if (input && !input.dataset.humanizerInputBound) {
    input.dataset.humanizerInputBound = "true";
    input.addEventListener("input", updateCreditPreview);
  }

  // Important: this works even if the script loads after DOMContentLoaded.
  if (button && !button.dataset.humanizerClickBound) {
    button.dataset.humanizerClickBound = "true";

    button.addEventListener("click", async () => {
      console.log("[Humanizer] Button clicked");

      try {
        await humanizeText();
      } catch (error) {
        console.error("[Humanizer] Click handler failed:", error);
        showMessage(error.message || "Humanization failed.");
      }
    });
  }

  if (refreshButton && !refreshButton.dataset.humanizerRefreshBound) {
    refreshButton.dataset.humanizerRefreshBound = "true";

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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeHumanizerUI, { once: true });
} else {
  initializeHumanizerUI();
}
