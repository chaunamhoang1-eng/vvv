let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
e.preventDefault();

deferredPrompt = e;

setTimeout(() => {

```
if (!deferredPrompt) return;

const ok = confirm(
  "Install PlagX app?"
);

if (ok) {
  deferredPrompt.prompt();

  deferredPrompt.userChoice
    .then((choice) => {
      console.log(choice.outcome);

      if (
        choice.outcome === "accepted"
      ) {
        console.log("Installed");
      }

      deferredPrompt = null;
    });
}
```

}, 1000);
});

window.addEventListener(
"appinstalled",
() => {
alert("PlagX installed!");
}
);
