const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// =====================
// 🤖 AI REPLY
// =====================
app.post("/ai-reply", (req, res) => {
    const { text } = req.body;

    let reply = "Got it 👍";

    if (text.toLowerCase().includes("how are you")) {
        reply = "I'm doing great! How about you?";
    }

    if (text.toLowerCase().includes("help")) {
        reply = "I can help you with that!";
    }

    res.json({ reply });
});

// =====================
// 💘 FLIRT AI
// =====================
app.post("/flirt", (req, res) => {
    const { text } = req.body;

    let reply = "You just made my day 😊";

    if (text.toLowerCase().includes("hi")) {
        reply = "Hey you 😏 I was hoping you'd text";
    }

    if (text.toLowerCase().includes("miss")) {
        reply = "I might miss you a little more 😉";
    }

    res.json({ reply });
});

// =====================
// 🌍 TRANSLATE (SIMPLE)
// =====================
app.post("/translate", (req, res) => {
    const { text } = req.body;

    // fake translation for now
    res.json({ translated: "[EN] " + text });
});

// =====================
// ❤️ HEALTH CHECK
// =====================
app.get("/", (req, res) => {
    res.send("AI Server Running 🚀");
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
