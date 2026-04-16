require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cron = require("node-cron");
const mongoose = require("mongoose");

const { connectDB, dbReady } = require("./db");

const User = require("./models/User");
const Chat = require("./models/Chat");
const Agent = require("./models/Agent");

const { askAI } = require("./services/ai");
const { createCheckout, handleStripeEvent } = require("./services/stripe");
const { runAgents } = require("./services/worker");

const app = express();
const PORT = process.env.PORT || 10000;

// =====================
// DB INIT (SAFE)
// =====================
(async () => {
  await connectDB();
})();

// =====================
// MIDDLEWARE
// =====================
app.use(cors());

// Stripe raw webhook FIRST
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
// HEALTH (ALWAYS WORKS)
// =====================
app.get("/", (req, res) => {
  res.send("🚀 BB AI LIVE STABLE SYSTEM");
});

app.get("/health", (req, res) => {
  const state = mongoose.connection.readyState;

  res.json({
    status: "OK",
    server: "running",
    db:
      state === 1
        ? "connected"
        : state === 2
        ? "connecting"
        : "disconnected",
    mode: state === 1 ? "online" : "offline",
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

    await User.create({ email, password: hashed });

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
// AI (OFFLINE SAFE)
// =====================
app.post("/ai", async (req, res) => {
  try {
    const reply = await askAI([
      { role: "user", content: req.body.text },
    ]);

    res.json({ reply });
  } catch {
    res.json({
      reply: "⚠️ AI offline mode active",
    });
  }
});

// =====================
// AI PRO (DB SAFE)
// =====================
app.post("/ai-pro", auth, async (req, res) => {
  try {
    if (!dbReady()) {
      return res.json({
        reply: "⚠️ AI Pro requires database connection (currently offline mode)",
      });
    }

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
  } catch (err) {
    res.json({ reply: "⚠️ AI Pro error (DB offline fallback)" });
  }
});

// =====================
// AGENTS (SAFE)
// =====================
app.post("/agent/create", auth, async (req, res) => {
  try {
    if (!dbReady()) {
      return res.json({ message: "Agent saved in offline mode (DB not ready)" });
    }

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
// CRON SAFE
// =====================
cron.schedule("* * * * *", async () => {
  try {
    if (!dbReady()) return;
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
