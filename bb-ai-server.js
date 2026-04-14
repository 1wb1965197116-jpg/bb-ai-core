const express = require("express");
const cors = require("cors");

const app = express();

// =====================
// MIDDLEWARE
// =====================
app.use(cors());
app.use(express.json());

// =====================
// 🧠 HEALTH CHECK (BROWSER SAFE)
// =====================
app.get("/", (req, res) => {
    res.send("BB AI Core Running 🚀");
});

// =====================
// 🧪 TEST ROUTE (DEBUGGING)
// =====================
app.get("/test", (req, res) => {
    res.json({ status: "OK", message: "API is working" });
});

// =====================
// 🤖 AI REPLY
// =====================
app.post("/ai-reply", (req, res) => {
    try {
        const text = (req.body?.text || "").toLowerCase();

        if (!text) {
            return res.json({ reply: "No input received 🤖" });
        }

        let reply = "Got it 👍";

        if (text.includes("how are you")) {
            reply = "I'm doing great! How about you?";
        } else if (text.includes("help")) {
            reply = "I can help you with that!";
        } else if (text.includes("what")) {
            reply = "Interesting question — tell me more.";
        }

        return res.json({ reply });

    } catch (error) {
        return res.status(500).json({
            error: "AI reply failed",
            details: error.message
        });
    }
});

// =====================
// 💘 FLIRT AI
// =====================
app.post("/flirt", (req, res) => {
    try {
        const text = (req.body?.text || "").toLowerCase();

        let reply = "You just made my day 😊";

        if (text.includes("hi") || text.includes("hello")) {
            reply = "Hey you 😏 I was hoping you'd text";
        } else if (text.includes("miss")) {
            reply = "I might miss you a little more 😉";
        } else if (text.includes("love")) {
            reply = "Careful... you're making me blush 😳";
        }

        return res.json({ reply });

    } catch (error) {
        return res.status(500).json({
            error: "Flirt AI failed",
            details: error.message
        });
    }
});

// =====================
// 🌍 TRANSLATE (SIMPLE PLACEHOLDER)
// =====================
app.post("/translate", (req, res) => {
    try {
        const text = req.body?.text || "";

        if (!text) {
            return res.json({ translated: "No text provided" });
        }

        return res.json({
            translated: "[EN] " + text
        });

    } catch (error) {
        return res.status(500).json({
            error: "Translation failed",
            details: error.message
        });
    }
});

// =====================
// 🚀 START SERVER (RENDER SAFE)
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`BB AI Core running on port ${PORT}`);
});
app.get("/ai-reply-test", (req, res) => {
    const text = (req.query.text || "").toLowerCase();

    if (!text) {
        return res.json({ reply: "Add ?text=hello to test 🤖" });
    }

    let reply = "Got it 👍";

    if (text.includes("how are you")) {
        reply = "I'm doing great! How about you?";
    } else if (text.includes("help")) {
        reply = "I can help you with that!";
    }

    res.json({ reply });
});
app.get("/flirt-test", (req, res) => {
    const text = (req.query.text || "").toLowerCase();

    if (!text) {
        return res.json({ reply: "Add ?text=hi to test 💘" });
    }

    let reply = "You just made my day 😊";

    if (text.includes("hi") || text.includes("hello")) {
        reply = "Hey you 😏 I was hoping you'd text";
    } else if (text.includes("miss")) {
        reply = "I might miss you a little more 😉";
    } else if (text.includes("love")) {
        reply = "Careful... you're making me blush 😳";
    }

    res.json({ reply });
});
