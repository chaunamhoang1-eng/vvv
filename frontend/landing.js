// ======================= SHOW POPUP ON PAGE LOAD =======================

// Run after page is fully loaded
window.addEventListener("load", () => {
  const popup = document.getElementById("discordNotice");

  if (!popup) {
    console.warn("Popup element #discordNotice not found!");
    return;
  }

  // show popup 1 second after loading
  setTimeout(() => {
    popup.classList.add("active");
  }, 1000);
});


// ======================= CLOSE POPUP =======================



// ======================= OPEN DISCORD LINK =======================

function openDiscord() {
  window.open("https://discord.gg/w7YyprcUN3", "_blank");
}

window.openDiscord = openDiscord;
