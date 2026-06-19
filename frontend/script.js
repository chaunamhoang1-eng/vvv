let deferredPrompt;

window.addEventListener("beforeinstallprompt", (e) => {
e.preventDefault();

deferredPrompt = e;

setTimeout(() => {
if (!deferredPrompt) return;

```
const install = confirm(
  "Install PlagX app for faster access?"
);

if (install) {
  deferredPrompt.prompt();

  deferredPrompt.userChoice.then(() => {
    deferredPrompt = null;
  });
}
```

}, 3000);
});

window.addEventListener("appinstalled", () => {
console.log("PlagX installed");
deferredPrompt = null;
});
