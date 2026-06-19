let installPrompt;

window.addEventListener(
"beforeinstallprompt",
(e) => {

e.preventDefault();

installPrompt = e;

const banner =
document.createElement("div");

banner.innerHTML = `

 <div style="
 position:fixed;
 top:20px;
 left:50%;
 transform:translateX(-50%);
 background:#2563eb;
 color:white;
 padding:14px 18px;
 border-radius:12px;
 z-index:99999;
 box-shadow:0 8px 20px rgba(0,0,0,.2);
 display:flex;
 gap:12px;
 align-items:center;
 ">
 Install PlagX App
 <button
 id="installNow"
 style="
 background:white;
 color:#2563eb;
 border:none;
 padding:8px 14px;
 border-radius:8px;
 cursor:pointer;
 ">
 Install
 </button>
 </div>
 `;

document.body.appendChild(
banner
);

document
.getElementById(
"installNow"
)
.onclick =
async () => {

await installPrompt.prompt();

banner.remove();

};

});

window.addEventListener(
"appinstalled",
() => {

alert(
"PlagX Installed!"
);

});
