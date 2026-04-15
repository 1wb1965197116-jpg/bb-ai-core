const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// =====================
// MEMORY DATABASE (TEMP)
// =====================
let users = {};
let conversations = {};

// =====================
// MIDDLEWARE
// =====================
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// =====================
// HEALTH CHECK
// =====================
app.get("/", (req, res) => {
    res.send("BB AI Core Running 🚀");
});

app.get("/test", (req, res) => {
    res.json({ status: "OK", message: "API is working" });
});

// =====================
// AUTH MIDDLEWARE
// =====================
function auth(req, res, next) {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Unauthorized" });
    }
}

// =====================
// REGISTER
// =====================
app.post("/register", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.json({ error: "Missing email or password" });
    }

    if (users[email]) {
        return res.json({ error: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    users[email] = {
        email,
        password: hashed,
        pro: false
    };

    res.json({ message: "User created" });
});

// =====================
// LOGIN
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
// STRIPE CHECKOUT
// =====================
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
                        name: "BB AI Pro"
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

app.get("/success", (req, res) => {
    res.send("Payment successful 🎉 You now have AI Pro access");
});

app.get("/cancel", (req, res) => {
    res.send("Payment cancelled");
});

// =====================
// PUBLIC AI (NO LOGIN)
// =====================
app.post("/ai-reply-public", async (req, res) => {
    try {
        const text = req.body?.text || "";

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are a helpful AI assistant." },
                    { role: "user", content: text }
                ]
            })
        });

        const data = await response.json();

        res.json({
            reply: data?.choices?.[0]?.message?.content || "No response"
        });

    } catch (err) {
        res.json({ reply: "AI error: " + err.message });
    }
});

// =====================
// PRO AI (LOGIN + MEMORY + LIMITS)
// =====================
app.post("/ai-reply", auth, async (req, res) => {
    try {
        const text = req.body?.text;
        const email = req.user.email;

        if (!text) {
            return res.json({ reply: "Send text 🤖" });
        }

        if (!conversations[email]) {
            conversations[email] = [];
        }

        const user = users[email];

        // FREE LIMIT
        if (!user?.pro && conversations[email].length > 6) {
            return res.json({
                reply: "🔒 Upgrade to Pro for unlimited AI access"
            });
        }

        conversations[email].push({ role: "user", content: text });

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are a helpful AI assistant." },
                    ...conversations[email]
                ]
            })
        });

        const data = await response.json();

        const reply = data?.choices?.[0]?.message?.content || "No response";

        conversations[email].push({ role: "assistant", content: reply });

        res.json({ reply });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =====================
// TRANSLATE
// =====================
app.post("/translate", (req, res) => {
    const text = req.body?.text || "";
    res.json({ translated: "[EN] " + text });
});

// =====================
// START SERVER
// =====================
app.listen(PORT, () => {
    console.log(`BB AI Core running on port ${PORT}`);
});
