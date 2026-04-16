require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cron = require("node-cron");
const mongoose = require("mongoose");
const path = require("path"); // ✅ ADDED

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
// CONNECT DB
// =====================
(async () => {
  await connectDB();
})();

// =====================
// MIDDLEWARE
// =====================
app.use(cors());
app.use(express.json());

// =====================
// FRONTEND STATIC SERVE
// =====================
app.use(express.static(path.join(__dirname, "frontend")));

// =====================
// FRONTEND ROUTES (SPA STYLE)
// =====================
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend/dashboard.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend/admin.html"));
});

app.get("/billing", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend/billing.html"));
});

// =====================
// STRIPE WEBHOOK (RAW BODY MUST BE FIRST)
// =====================
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

// =====================
// AUTH MIDDLEWARE
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
// HEALTH
// =====================
app.get("/", (req, res) => {
  res.send("🚀 AI OS FULL STACK RUNNING");
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
// AUTH ROUTES
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
// AI ENDPOINT
// =====================
app.post("/ai", auth, async (req, res) => {
  try {
    const reply = await askAI([
      { role: "user", content: req.body.text },
    ]);

    res.json({ reply });

  } catch {
    res.json({ reply: "⚠️ AI fallback active" });
  }
});

// =====================
// AI PRO
// =====================
app.post("/ai-pro", auth, async (req, res) => {
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
// AGENT SYSTEM
// =====================
app.post("/agent/create", auth, async (req, res) => {
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
// STRIPE
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
// CRON JOBS
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
  console.log(`🚀 Server running on port ${PORT}`);
});
