async function humanizeText() {
  let text = document.getElementById("inputText").value.trim();
  let tone = document.getElementById("toneSelect").value;

  if (!text) {
    alert("Please enter text");
    return;
  }

  if (text.split(" ").length < 50) {
    alert("Text must be at least 50 words.");
    return;
  }

  const resultBox = document.getElementById("resultBox");
  resultBox.style.display = "block";
  resultBox.innerText = "Processing...";

  try {
    const response = await fetch("http://72.62.245.85:8005/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": "kamla-admin-69"
      },
      body: JSON.stringify({
        text: text,
        tone: tone
      })
    });

    const data = await response.json();

    if (data.status !== "success") {
      resultBox.innerText = "API Error: " + (data.message || "Unknown error");
      return;
    }

    const best = data.results[0];

    resultBox.innerHTML = `
      <strong>Humanized Output:</strong><br><br>
      ${best.text}<br><br>

      <strong>Score:</strong> ${best.score}<br>
      <strong>Risk Flag:</strong> ${best.risk_flag || "None"}<br><br>

      <strong>Usage Today:</strong> ${data.usage_today}<br>
      <strong>Remaining Today:</strong> ${data.remaining_today}
    `;
  } catch (error) {
    resultBox.innerText = "Error: Could not reach the Humanizer API.";
  }
}
