const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();

// =====================
// MIDDLEWARE
// =====================
app.use(cors());
app.use(express.json());

// =====================
// 🧠 HEALTH CHECK
// =====================
app.get("/", (req, res) => {
    res.send("BB AI Core Running 🚀");
});

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
// 🤖 REAL AI (NO node-fetch, SAFE FETCH)
// =====================
app.post("/ai-reply", async (req, res) => {
    try {
        const text = req.body?.text;

        if (!text) {
            return res.json({ reply: "Send text to chat 🤖" });
        }

        const response = await globalThis.fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are a helpful AI keyboard assistant." },
                    { role: "user", content: text }
                ]
            })
        });

        const data = await response.json();

        const reply = data?.choices?.[0]?.message?.content || "No response";

        res.json({ reply });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =====================
// 💘 FLIRT AI
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
// 🌍 TRANSLATE
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

app.get("/translate-test", (req, res) => {
    const text = req.query.text || "";

    if (!text) {
        return res.json({ translated: "Add ?text=hello to test 🌍" });
    }

    res.json({ translated: "[EN] " + text });
});

// =====================
// 🚀 START SERVER
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`BB AI Core running on port ${PORT}`);
});
