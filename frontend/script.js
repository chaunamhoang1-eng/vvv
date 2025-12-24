window.onload = () => {
  const popup = document.getElementById("discord-popup");
  popup.style.visibility = "visible";
  popup.style.opacity = "1";
};

function closePopup() {
  const popup = document.getElementById("discord-popup");
  popup.style.opacity = "0";
  setTimeout(() => popup.style.visibility = "hidden", 300);
}
