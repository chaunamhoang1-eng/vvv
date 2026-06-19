let installEvent = null;

window.addEventListener(
"beforeinstallprompt",
(e) => {

e.preventDefault();

installEvent = e;

setTimeout(async () => {

if (!installEvent) return;

alert("Install available");

await installEvent.prompt();

const choice =
await installEvent.userChoice;

console.log(choice);

installEvent = null;

}, 1000);

});

window.addEventListener(
"appinstalled",
() => {

alert(
"PlagX Installed!"
);

});
