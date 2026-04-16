const API = "";

function goTo(page) {
  window.location.href = page;
}

async function loadHealth() {
  const res = await fetch(API + "/health");
  const data = await res.json();

  document.getElementById("statusBox").innerText =
    JSON.stringify(data, null, 2);
}
