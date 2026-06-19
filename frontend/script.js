let installPrompt;

window.addEventListener(
"beforeinstallprompt",
(e) => {

e.preventDefault();

installPrompt = e;

const ok =
confirm(
"Install PlagX?"
);

if (ok) {
installPrompt.prompt();
}

});

window.addEventListener(
"appinstalled",
() => {

alert(
"PlagX installed"
);

});
