async function send() {
    const input = document.getElementById("text");
    const text = input.value.trim();

    if (!text) return;

    input.value = "";

    addMessage("user", text);

    addMessage("ai", "Typing...");

    try {
        const res = await fetch("/ai-reply-public", {
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
        addMessage("ai", "Error connecting to server");
    }
}

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
