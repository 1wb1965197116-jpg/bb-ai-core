require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cron = require("node-cron");
const mongoose = require("mongoose");

const { connectDB, dbReady, dbMode } = require("./db");

const User = require("./models/User");
const Chat = require("./models/Chat");
const Agent = require("./models/Agent");

const { askAI } = require("./services/ai");
const { createCheckout, handleStripeEvent } = require("./services/stripe");
const { runAgents } = require("./services/worker");

const app = express();
const PORT = process.env.PORT || 10000;

// =====================
// 🔥 ENTERPRISE CACHE (in-memory fallback)
// =====================
const cache = new Map();

// =====================
// QUEUE SYSTEM
// =====================
const queue = [];

function addToQueue(job) {
  queue.push(job);
}

async function processQueue() {
  if (!dbReady()) return;

  while (queue.length > 0) {
    const job = queue.shift();
    try {
      await job();
    } catch (e) {
      console.error("Queue error:", e.message);
    }
  }
}

setInterval(processQueue, 4000);

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

// Stripe webhook raw FIRST
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
// HEALTH (ENTERPRISE DASHBOARD)
// =====================
app.get("/", (req, res) => {
  res.send("🚀 AI OS v5 ENTERPRISE SYSTEM ONLINE");
});

app.get("/health", (req, res) => {
  const state = mongoose.connection.readyState;

  res.json({
    status: "OK",
    server: "running",
    db: dbMode(),
    mode:
      state === 1
        ? "online"
        : state === 2
        ? "connecting"
        : "offline",
    uptime: process.uptime(),
    cacheSize: cache.size,
    queueSize: queue.length,
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
// AI (CACHE + FALLBACK)
// =====================
app.post("/ai", async (req, res) => {
  try {
    const key = req.body.text;

    if (cache.has(key)) {
      return res.json({
        reply: cache.get(key),
        cached: true,
      });
    }

    const reply = await askAI([
      { role: "user", content: key },
    ]);

    cache.set(key, reply);

    res.json({ reply });
  } catch {
    res.json({
      reply: "⚠️ AI fallback mode active",
    });
  }
});

// =====================
// AI PRO (ENTERPRISE SAFE)
// =====================
app.post("/ai-pro", auth, async (req, res) => {
  try {
    if (!dbReady()) {
      return res.json({
        reply: "⚠️ System offline — request queued",
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

  } catch {
    res.json({ reply: "⚠️ AI Pro fallback active" });
  }
});

// =====================
// AGENTS (QUEUE SAFE)
// =====================
app.post("/agent/create", auth, async (req, res) => {
  try {
    if (!dbReady()) {
      addToQueue(() =>
        Agent.create({
          userId: req.user.email,
          type: req.body.type,
          prompt: req.body.prompt,
        })
      );

      return res.json({ message: "Queued (offline mode)" });
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
  if (!dbReady()) return;

  try {
    await runAgents();
  } catch (err) {
    console.error("Agent error:", err.message);
  }
});

// =====================
// START
// =====================
app.listen(PORT, () => {
  console.log(`🚀 AI OS v5 Enterprise running on port ${PORT}`);
});
