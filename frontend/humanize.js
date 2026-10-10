let humanizeInProgress = false;

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

async function humanizeText() {
  if (humanizeInProgress) return;

  const text = document.getElementById("inputText").value.trim();
  const tone = document.getElementById("toneSelect").value;
  const resultBox = document.getElementById("resultBox");

  if (!text) {
    alert("Please enter text");
    return;
  }

  const wordCount = text.split(/\s+/).length;

  if (wordCount < 50) {
    alert("Text must be at least 50 words.");
    return;
  }

  humanizeInProgress = true;
  resultBox.style.display = "block";
  resultBox.textContent = "Submitting text...";

  try {
    const response = await fetch("/api/humanize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({
        text,
        tone
      })
    });

    const data = await response.json();

    if (!response.ok || !data.jobId) {
      throw new Error(data.error || "Submission failed");
    }

    const jobId = data.jobId;

    resultBox.textContent =
      "Humanizing your text. Please wait...";

    // Check the job until completed.
    for (let attempt = 0; attempt < 40; attempt++) {
      const jobResponse = await fetch(
        `/api/humanize/jobs/${encodeURIComponent(jobId)}`,
        { credentials: "same-origin" }
      );

      const job = await jobResponse.json();

      if (!jobResponse.ok) {
        throw new Error(job.error || "Could not check job");
      }

      if (job.status === "done") {
        resultBox.replaceChildren();

        const heading = document.createElement("strong");
        heading.textContent = "Humanized Output:";

        const output = document.createElement("div");
        output.style.whiteSpace = "pre-wrap";
        output.style.marginTop = "12px";
        output.textContent = job.text || "";

        resultBox.append(heading, output);

        if (job.wordsCharged !== undefined) {
          const usage = document.createElement("p");
          usage.textContent =
            `Words charged: ${job.wordsCharged}`;
          resultBox.appendChild(usage);
        }

        return;
      }

      if (job.status === "failed") {
        throw new Error(
          job.error || "Humanization failed"
        );
      }

      resultBox.textContent =
        `Processing... ${job.progress?.percent ?? 0}%`;

      await sleep(3000);
    }

    resultBox.textContent =
      "Processing is taking longer than expected. " +
      "Please check your job history before submitting again.";

  } catch (error) {
    resultBox.textContent = "Error: " + error.message;
  } finally {
    humanizeInProgress = false;
  }
}
