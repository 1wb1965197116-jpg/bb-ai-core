const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// =====================
// 🧠 IN-MEMORY DB (TEMP)
// =====================
let users = {};
let conversations = {};

// =====================
// ⚠️ STRIPE WEBHOOK NEEDS RAW BODY FIRST
// =====================
app.post("/stripe-webhook", express.raw({ type: "application/json" }), (req, res) => {
    try {
        const event = req.body;

        if (event.type === "checkout.session.completed") {
            const email = event.data.object.customer_email;

            if (users[email]) {
                users[email].pro = true;
                console.log("🔥 PRO UNLOCKED:", email);
            }
        }

        res.json({ received: true });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =====================
// MIDDLEWARE
// =====================
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// =====================
// 🧪 TEST
// =====================
app.get("/test", (req, res) => {
    res.json({ status: "OK", message: "API is working" });
});

// =====================
// 🔐 AUTH MIDDLEWARE
// =====================
function auth(req, res, next) {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ error: "Unauthorized" });
    }
}

// =====================
// 👤 REGISTER
// =====================
app.post("/register", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.json({ error: "Missing fields" });
    }

    if (users[email]) {
        return res.json({ error: "User exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    users[email] = {
        password: hashed,
        pro: false
    };

    res.json({ message: "User created" });
});

// =====================
// 🔑 LOGIN
// =====================
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const user = users[email];
    if (!user) return res.json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.json({ error: "Wrong password" });

    const token = jwt.sign({ email }, JWT_SECRET);

    res.json({ token });
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
        const { email } = req.body;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "subscription",
            customer_email: email,
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
// 🤖 AI (MEMORY + MODES + PRO LOCK)
// =====================
app.post("/ai-reply", auth, async (req, res) => {
    try {
        const text = req.body?.text;
        const mode = req.body?.mode || "normal";
        const email = req.user.email;
        const user = users[email];

        if (!text) {
            return res.json({ reply: "Send text 🤖" });
        }

        if (!conversations[email]) {
            conversations[email] = [];
        }

        // 🔒 FREE LIMIT
        if (!user.pro && conversations[email].length > 6) {
            return res.json({
                reply: "🔒 Upgrade to Pro for unlimited AI"
            });
        }

        // 🎭 MODE SYSTEM
        let systemPrompt = "You are a helpful AI assistant.";

        if (mode === "flirt") {
            systemPrompt = "You are a smooth, human-like flirty assistant.";
        } else if (mode === "business") {
            systemPrompt = "You are a professional business assistant.";
        }

        conversations[email].push({
            role: "user",
            content: text
        });

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
                    ...conversations[email]
                ]
            })
        });

        const data = await response.json();
        const reply = data?.choices?.[0]?.message?.content || "No response";

        conversations[email].push({
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
// 🌍 TRANSLATE
// =====================
app.post("/translate", (req, res) => {
    const text = req.body?.text || "";
    res.json({ translated: "[EN] " + text });
});

// =====================
// 🚀 START SERVER
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`BB AI Core running on port ${PORT}`);
});
