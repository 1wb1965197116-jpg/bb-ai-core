const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:10000"
    : window.location.origin;

async function callAI(text) {
  const res = await fetch(`${API_BASE}/ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({ text })
  });

  return await res.json();
}
