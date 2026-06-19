
let installPrompt;

window.addEventListener("beforeinstallprompt", (e) => {
 e.preventDefault();

 installPrompt = e;

 const btn =
 document.getElementById("installBtn");

 if (btn) {
   btn.style.display = "block";
 }
});

async function installApp() {
 if (!installPrompt) return;

 installPrompt.prompt();

 await installPrompt.userChoice;

 installPrompt = null;
}
