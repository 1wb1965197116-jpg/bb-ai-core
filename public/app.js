const API = "https://bb-ai-core.onrender.com";

// =====================
// 💳 STRIPE UPGRADE
// =====================
async function upgrade() {
  const email = prompt("Enter your email");

  if (!email) return;

  try {
    const res = await fetch(`${API}/create-subscription`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert("Error creating payment");
    }
  } catch (err) {
    alert("Payment error");
  }
}

// =====================
// 🤖 AI CHAT
// =====================
async function send() {
  const input = document.getElementById("text");
  const text = input.value.trim();

  if (!text) return;

  input.value = "";

  addMessage("user", text);
  addMessage("ai", "Typing...");

  try {
    const res = await fetch(`${API}/ai-reply-public`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    const data = await res.json();

    removeLastMessage();

    addMessage("ai", data.reply || "No response");

  } catch (err) {
    removeLastMessage();
    addMessage("ai", "Server error");
  }
}

// =====================
// 💬 UI HELPERS
// =====================
function addMessage(role, text) {
  const chat = document.getElementById("chat");

  const div = document.createElement("div");
  div.className = "msg " + role;
  div.innerText = text;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function removeLastMessage() {
  const chat = document.getElementById("chat");
  const msgs = chat.getElementsByClassName("msg");

  if (msgs.length > 0) {
    chat.removeChild(msgs[msgs.length - 1]);
  }
}

// =====================
// 🎤 VOICE INPUT (SAFE)
// =====================
function startVoice() {
  if (!('webkitSpeechRecognition' in window)) {
    alert("Voice not supported on this device");
    return;
  }

  const recognition = new webkitSpeechRecognition();

  recognition.onresult = (event) => {
    document.getElementById("text").value =
      event.results[0][0].transcript;
  };

  recognition.onerror = () => {
    alert("Voice recognition error");
  };

  recognition.start();
}
