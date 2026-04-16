require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cron = require("node-cron");
const mongoose = require("mongoose");

const { connectDB } = require("./db");

const User = require("./models/User");
const Chat = require("./models/Chat");
const Agent = require("./models/Agent");

const { askAI } = require("./services/ai");
const { createCheckout, handleStripeEvent } = require("./services/stripe");
const { runAgents } = require("./services/worker");

const app = express();
const PORT = process.env.PORT || 10000;

// =====================
// SAAS METRICS CORE
// =====================
const aiCache = new Map();

// =====================
// DB INIT
// =====================
(async () => {
  await connectDB();
})();

// =====================
// MIDDLEWARE
// =====================
app.use(cors());

// Stripe webhook MUST stay raw
app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const event = JSON.parse(req.body.toString());
      await handleStripeEvent(event);
      res.json({ received: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.use(express.json());

// =====================
// AUTH
// =====================
function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });

    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

// =====================
// PRO GUARD (SAAS CORE)
// =====================
async function requirePro(req, res, next) {
  const user = await User.findOne({ email: req.user.email });

  if (!user?.pro) {
    return res.status(403).json({
      error: "Pro subscription required",
    });
  }

  next();
}

// =====================
// HEALTH
// =====================
app.get("/", (req, res) => {
  res.send("🚀 AI OS v9 SAAS PLATFORM LIVE");
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    server: "running",
    db: mongoose.connection.readyState === 1 ? "connected" : "offline",
    mode: mongoose.connection.readyState === 1 ? "online" : "degraded",
    uptime: process.uptime(),
  });
});

// =====================
// REGISTER / LOGIN
// =====================
app.post("/register", async (req, res) => {
  try {
    const bcrypt = require("bcryptjs");

    const { email, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    await User.create({
      email,
      password: hashed,
      pro: false,
      usage: 0,
    });

    res.json({ message: "User created" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const bcrypt = require("bcryptjs");

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.json({ error: "Wrong password" });

    const token = jwt.sign({ email }, process.env.JWT_SECRET);

    res.json({ token });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// AI (FREE + LIMITS)
// =====================
app.post("/ai", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });

    user.usage = (user.usage || 0) + 1;

    if (!user.pro && user.usage > 25) {
      return res.json({
        reply: "Free limit reached. Upgrade to Pro.",
      });
    }

    await user.save();

    const key = req.body.text;

    if (aiCache.has(key)) {
      return res.json({
        reply: aiCache.get(key),
        cached: true,
      });
    }

    const reply = await askAI([
      { role: "user", content: key },
    ]);

    aiCache.set(key, reply);

    res.json({ reply });

  } catch {
    res.json({ reply: "⚠️ AI fallback active" });
  }
});

// =====================
// PRO AI (FULL MEMORY)
// =====================
app.post("/ai-pro", auth, requirePro, async (req, res) => {
  try {
    let chat = await Chat.findOne({ userId: req.user.email });

    if (!chat) {
      chat = new Chat({
        userId: req.user.email,
        messages: [],
      });
    }

    chat.messages.push({
      role: "user",
      content: req.body.text,
    });

    const reply = await askAI(chat.messages);

    chat.messages.push({
      role: "assistant",
      content: reply,
    });

    await chat.save();

    res.json({ reply });

  } catch {
    res.json({ reply: "⚠️ AI Pro fallback active" });
  }
});

// =====================
// AGENTS (PRO ONLY)
// =====================
app.post("/agent/create", auth, requirePro, async (req, res) => {
  try {
    await Agent.create({
      userId: req.user.email,
      type: req.body.type,
      prompt: req.body.prompt,
    });

    res.json({ message: "Agent created" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// STRIPE BILLING
// =====================
app.post("/create-subscription", async (req, res) => {
  try {
    const session = await createCheckout(req.body.email);
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// STRIPE WEBHOOK HANDLER
// =====================
app.post("/stripe-webhook", async (req, res) => {
  try {
    const event = req.body;
    await handleStripeEvent(event);
    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// CRON WORKER
// =====================
cron.schedule("* * * * *", async () => {
  try {
    await runAgents();
  } catch (err) {
    console.error("Agent error:", err.message);
  }
});

// =====================
// START SERVER
// =====================
app.listen(PORT, () => {
  console.log(`🚀 AI OS v9 SaaS running on port ${PORT}`);
});
