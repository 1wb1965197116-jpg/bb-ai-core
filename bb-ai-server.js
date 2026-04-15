const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();

// =====================
// 🧠 MEMORY STORE
// =====================
let conversations = {};

// =====================
// MIDDLEWARE
// =====================
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// =====================
// 🧪 TEST ROUTE
// =====================
app.get("/test", (req, res) => {
    res.json({ status: "OK", message: "API is working" });
});

// =====================
// 💳 STRIPE ROUTES
// =====================
app.get("/success", (req, res) => {
    res.send("Payment successful 🎉 You now have AI Pro access");
});

app.get("/cancel", (req, res) => {
    res.send("Payment cancelled");
});

app.post("/create-subscription", async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "subscription",
            line_items: [{
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: "BB AI Keyboard Pro"
                    },
                    unit_amount: 999,
                    recurring: { interval: "month" }
                },
                quantity: 1
            }],
            success_url: "https://bb-ai-core.onrender.com/success",
            cancel_url: "https://bb-ai-core.onrender.com/cancel"
        });

        res.json({ url: session.url });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =====================
// 🤖 AI REPLY (MEMORY + MODES + PRO LOCK)
// =====================
app.post("/ai-reply", async (req, res) => {
    try {
        const text = req.body?.text;
        const userId = req.body?.userId || "default";
        const mode = req.body?.mode || "normal";
        const isPro = req.body?.pro === true;

        if (!text) {
            return res.json({ reply: "Send text to chat 🤖" });
        }

        // init memory
        if (!conversations[userId]) {
            conversations[userId] = [];
        }

        // 🔒 FREE LIMIT
        if (!isPro && conversations[userId].length > 6) {
            return res.json({
                reply: "🔒 Upgrade to Pro for unlimited AI access"
            });
        }

        // 🎭 MODE SYSTEM
        let systemPrompt = "You are a helpful AI assistant.";

        if (mode === "flirt") {
            systemPrompt = "You are a charming, flirty, human-like assistant.";
        } else if (mode === "business") {
            systemPrompt = "You are a professional business assistant.";
        }

        // store user message
        conversations[userId].push({
            role: "user",
            content: text
        });

        // call AI (NO node-fetch needed)
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...conversations[userId]
                ]
            })
        });

        const data = await response.json();

        const reply = data?.choices?.[0]?.message?.content || "No response";

        // store AI reply
        conversations[userId].push({
            role: "assistant",
            content: reply
        });

        res.json({ reply });

    } catch (err) {
        res.status(500).json({
            error: "AI failed",
            details: err.message
        });
    }
});

// =====================
// 💘 FLIRT AI (LIGHTWEIGHT)
// =====================
app.post("/flirt", (req, res) => {
    const text = (req.body?.text || "").toLowerCase();

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

// =====================
// 🌍 TRANSLATE (PLACEHOLDER)
// =====================
app.post("/translate", (req, res) => {
    const text = req.body?.text || "";

    if (!text) {
        return res.json({ translated: "No text provided" });
    }

    res.json({ translated: "[EN] " + text });
});

// =====================
// 🌐 BROWSER TEST ROUTES
// =====================
app.get("/ai-reply-test", (req, res) => {
    const text = (req.query.text || "").toLowerCase();

    if (!text) {
        return res.json({ reply: "Add ?text=hello 🤖" });
    }

    res.json({ reply: "Test response: " + text });
});

app.get("/translate-test", (req, res) => {
    const text = req.query.text || "";

    res.json({ translated: "[EN] " + text });
});

// =====================
// 🚀 START SERVER
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`BB AI Core running on port ${PORT}`);
});
