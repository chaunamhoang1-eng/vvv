let humanizeInProgress = false;

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

// Wait for Firebase to finish restoring the current session.
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
    alert("Please enter text.");
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

  humanizeInProgress = true;
  resultBox.style.display = "block";
  resultBox.textContent = "Checking your login...";

  try {
    const user = await waitForFirebaseUser();

    if (!user) {
      alert(
        "Your Firebase session is not available on this page. " +
        "Please log in again."
      );
      return;
    }

    const token = await user.getIdToken();

    resultBox.textContent = "Submitting text...";

    const response = await fetch("/api/humanize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      credentials: "same-origin",
      body: JSON.stringify({
        text,
        tone
      })
    });

    const data = await response.json();

    if (!response.ok || data.jobId == null) {
      throw new Error(
        data.error || data.message || "Submission failed."
      );
    }

    const jobId = data.jobId;

    resultBox.textContent =
      "Humanizing your text. Please wait...";

    // Poll every 3 seconds for up to 2 minutes.
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
          job.error || job.message || "Could not check job."
        );
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

        if (job.wordsCharged != null) {
          const usage = document.createElement("p");
          usage.textContent =
            `Words charged: ${job.wordsCharged}`;
          resultBox.appendChild(usage);
        }

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
      "Processing is taking longer than expected. " +
      "Please check the job status before submitting again.";

  } catch (error) {
    console.error("Humanizer error:", error);
    resultBox.textContent = "Error: " + error.message;
  } finally {
    humanizeInProgress = false;
  }
}

// Required by the onclick="humanizeText()" in your HTML.
window.humanizeText = humanizeText;
