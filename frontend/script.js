let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
e.preventDefault();

deferredPrompt = e;

setTimeout(async () => {

if (!deferredPrompt) return;

const ok = confirm(
"Install PlagX app?"
);

if (ok) {
await deferredPrompt.prompt();
deferredPrompt = null;
}

}, 3000);
});

window.addEventListener("appinstalled", () => {
console.log("Installed");
});
