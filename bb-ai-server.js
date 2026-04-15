require("dotenv").config();

const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const { User, Chat } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET;

// =====================
// CONNECT DB
// =====================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.log(err));

// =====================
// MIDDLEWARE
// =====================
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// =====================
// AUTH
// =====================
function auth(req, res, next) {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: "Unauthorized" });
    }
}

// =====================
// REGISTER
// =====================
app.post("/register", async (req, res) => {
    const { email, password } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.json({ error: "User exists" });

    const hashed = await bcrypt.hash(password, 10);

    await User.create({
        email,
        password: hashed,
        pro: false
    });

    res.json({ message: "User created" });
});

// =====================
// LOGIN
// =====================
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.json({ error: "User not found" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.json({ error: "Wrong password" });

    const token = jwt.sign({ email }, JWT_SECRET);

    res.json({ token });
});

// =====================
// STRIPE CHECKOUT
// =====================
app.post("/create-subscription", async (req, res) => {
    const { email } = req.body;

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        customer_email: email,
        line_items: [{
            price_data: {
                currency: "usd",
                product_data: { name: "BB AI Pro" },
                unit_amount: 999,
                recurring: { interval: "month" }
            },
            quantity: 1
        }],
        success_url: "https://bb-ai-core.onrender.com/success",
        cancel_url: "https://bb-ai-core.onrender.com/cancel"
    });

    res.json({ url: session.url });
});

// =====================
// STRIPE WEBHOOK (AUTO PRO UNLOCK)
// =====================
app.post("/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const event = JSON.parse(req.body);

    if (event.type === "checkout.session.completed") {
        const email = event.data.object.customer_email;

        await User.findOneAndUpdate(
            { email },
            { pro: true }
        );

        console.log("🔥 PRO UNLOCKED:", email);
    }

    res.json({ received: true });
});

// =====================
// AI CHAT (PRO + MEMORY)
// =====================
app.post("/ai-reply", auth, async (req, res) => {
    try {
        const { text } = req.body;
        const email = req.user.email;

        let chat = await Chat.findOne({ email });

        if (!chat) {
            chat = new Chat({ email, messages: [] });
        }

        const user = await User.findOne({ email });

        if (!user.pro && chat.messages.length > 6) {
            return res.json({ reply: "🔒 Upgrade to Pro" });
        }

        chat.messages.push({ role: "user", content: text });

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: chat.messages
            })
        });

        const data = await response.json();
        const reply = data?.choices?.[0]?.message?.content || "No response";

        chat.messages.push({ role: "assistant", content: reply });

        await chat.save();

        res.json({ reply });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =====================
// START SERVER
// =====================
app.listen(PORT, () => {
    console.log(`BB AI SaaS running on port ${PORT}`);
});
