let deferredPrompt = null;

window.addEventListener(
"beforeinstallprompt",
(e) => {
e.preventDefault();

```
deferredPrompt = e;

setTimeout(() => {

  if (!deferredPrompt) return;

  deferredPrompt.prompt();

  deferredPrompt.userChoice
  .then((choice) => {

    console.log(
      "Install:",
      choice.outcome
    );

    deferredPrompt = null;
  });

}, 3000);
```

}
);

window.addEventListener(
"appinstalled",
() => {

```
alert(
  "PlagX installed successfully!"
);

deferredPrompt = null;
```

}
);
