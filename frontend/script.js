let installPrompt;

window.addEventListener("beforeinstallprompt", (e) => {
 e.preventDefault();

 installPrompt = e;

 document
  .getElementById("installBtn")
  .style.display = "block";
});

async function installApp() {
 if (!installPrompt) return;

 installPrompt.prompt();

 await installPrompt.userChoice;

 installPrompt = null;
}
