let humanizeInProgress = false;

const sleep = ms =>
new Promise(resolve => setTimeout(resolve, ms));

async function humanizeText() {
if (humanizeInProgress) return;

const input = document.getElementById("inputText");
const toneSelect = document.getElementById("toneSelect");
const resultBox = document.getElementById("resultBox");

if (!input || !toneSelect || !resultBox) {
console.error("Humanizer UI elements are missing.");
return;
}

const text = input.value.trim();
const tone = toneSelect.value;

if (!text) {
alert("Please enter text");
return;
}

if (text.split(/\s+/).length < 50) {
alert("Text must be at least 50 words.");
return;
}

if (text.length > 100000) {
alert("Text exceeds the maximum allowed length.");
return;
}

// Uses the Firebase Auth instance already initialized by your app.
// Ensure your Firebase frontend exposes `auth` as shown below.
const firebaseAuthInstance = window\.auth;

if (!firebaseAuthInstance?.currentUser) {
alert("Please log in before using the humanizer.");
return;
}

humanizeInProgress = true;
resultBox.style.display = "block";
resultBox.textContent = "Submitting text...";

try {
const token = await firebaseAuthInstance.currentUser.getIdToken();

```
const authHeaders = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${token}`
};

const response = await fetch("/api/humanize", {
  method: "POST",
  headers: authHeaders,
  credentials: "same-origin",
  body: JSON.stringify({ text, tone })
});

const data = await response.json();

if (!response.ok || !data.jobId) {
  throw new Error(data.error || data.message || "Submission failed");
}

const jobId = data.jobId;

resultBox.textContent = "Humanizing your text. Please wait...";

for (let attempt = 0; attempt < 40; attempt++) {
  await sleep(3000);

  const jobResponse = await fetch(
    `/api/humanize/jobs/${encodeURIComponent(jobId)}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      credentials: "same-origin"
    }
  );

  const job = await jobResponse.json();

  if (!jobResponse.ok) {
    throw new Error(
      job.error || job.message || "Could not check job"
    );
  }

  const status = String(job.status || "").toLowerCase();

  if (["done", "completed", "succeeded", "success"].includes(status)) {
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

    if (job.wordsCharged !== undefined && job.wordsCharged !== null) {
      const usage = document.createElement("p");
      usage.textContent = `Words charged: ${job.wordsCharged}`;
      resultBox.appendChild(usage);
    }

    return;
  }

  if (["failed", "error", "cancelled", "canceled"].includes(status)) {
    throw new Error(job.error || "Humanization failed");
  }

  const percent = job.progress?.percent;
  resultBox.textContent =
    typeof percent === "number"
      ? `Processing... ${percent}%`
      : "Humanizing your text. Please wait...";
}

resultBox.textContent =
  "Processing is taking longer than expected. " +
  "Your job may still be running; check its status before submitting again.";
```

} catch (error) {
console.error("Humanizer error:", error);
resultBox.textContent = "Error: " + error.message;
} finally {
humanizeInProgress = false;
}
}
