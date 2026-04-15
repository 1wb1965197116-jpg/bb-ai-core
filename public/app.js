const API_BASE = "https://bb-ai-core.onrender.com"; 
// change to "" if running locally

async function send() {
  const input = document.getElementById("text");
  const text = input.value;
  input.value = "";

  addMessage("user", text);

  try {
    const res = await fetch(`${API_BASE}/ai-reply-public`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    const data = await res.json();

    addMessage("ai", data.reply || "No response");

  } catch (err) {
    addMessage("ai", "Error connecting to server");
  }
}

// =====================
// CHAT UI
// =====================
function addMessage(role, text) {
  const chat = document.getElementById("chat");

  const div = document.createElement("div");
  div.className = "msg " + role;
  div.innerText = text;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
