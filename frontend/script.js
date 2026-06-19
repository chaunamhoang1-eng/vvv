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
top:70px;
left:50%;
transform:translateX(-50%);
background:#2563eb;
color:white;
padding:14px;
border-radius:14px;
z-index:99999;
box-shadow:0 8px 20px rgba(0,0,0,.25);
display:flex;
align-items:center;
justify-content:space-between;
width:85%;
max-width:320px;
">

<div>
<div style="
font-size:16px;
font-weight:700;">
Install PlagX
</div>

<div style="
font-size:13px;">
Use like an app
</div>
</div>

<div style="
display:flex;
gap:8px;">

<button
id="installNow"
style="
background:white;
color:#2563eb;
border:none;
padding:8px 14px;
border-radius:10px;">
Install </button>

<button
id="closeInstall"
style="
background:transparent;
color:white;
border:none;
font-size:22px;">
× </button>

</div>

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

document
.getElementById(
"closeInstall"
)
.onclick =
() => {

banner.remove();

};

});
