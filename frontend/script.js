window.addEventListener(
"beforeinstallprompt",
(e) => {

e.preventDefault();

console.log(
"INSTALL EVENT FIRED"
);

alert(
"Install available"
);

e.prompt();

});

window.addEventListener(
"appinstalled",
() => {

alert(
"Installed"
);

});
