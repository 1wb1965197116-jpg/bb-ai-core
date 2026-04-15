async function send() {
  const input = document.getElementById("text");
  const text = input.value;
  input.value = "";

  addMessage("user", text);

  const res = await fetch("/ai-reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });

  const data = await res.json();

  addMessage("ai", data.reply);
}

function addMessage(role, text) {
  const chat = document.getElementById("chat");

  const div = document.createElement("div");
  div.className = "msg " + role;
  div.innerText = text;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
