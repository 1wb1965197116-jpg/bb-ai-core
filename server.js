require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cron = require("node-cron");
const mongoose = require("mongoose");

const { connectDB, dbHealth } = require("./db");
const {
  recordDBFailure,
  recordAIRequest,
  recordCacheHit,
  getSystemMetrics,
} = require("./systemCore");

const User = require("./models/User");
const Chat = require("./models/Chat");
const Agent = require("./models/Agent");

const { askAI } = require("./services/ai");
const { createCheckout, handleStripeEvent } = require("./services/stripe");
const { runAgents } = require("./services/worker");

const app = express();
const PORT = process.env.PORT || 10000;

// =====================
// SYSTEM MEMORY LAYERS
// =====================
const aiCache = new Map();
const memoryQueue = [];

// =====================
// QUEUE ENGINE
// =====================
function queueJob(job) {
  memoryQueue.push({
    job,
    time: Date.now(),
  });
}

setInterval(async () => {
  if (mongoose.connection.readyState !== 1) return;

  const batch = Math.min(5, memoryQueue.length);

  for (let i = 0; i < batch; i++) {
    const item = memoryQueue.shift();

    try {
      await item.job();
    } catch (err) {
      console.error("Queue error:", err.message);
    }
  }
}, 3000);

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

// Stripe webhook MUST come first
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
// HEALTH (SYSTEM BRAIN)
// =====================
app.get("/", (req, res) => {
  res.send("🚀 AI OS v7 FULL ENTERPRISE SYSTEM RUNNING");
});

app.get("/health", (req, res) => {
  const state = mongoose.connection.readyState;

  res.json({
    status: "OK",
    server: "running",

    db:
      state === 1
        ? "connected"
        : "offline",

    mode: state === 1 ? "online" : "degraded",
    uptime: process.uptime(),

    system: {
      queueDepth: memoryQueue.length,
      cacheSize: aiCache.size,
      dbHealth: dbHealth(),
      metrics: getSystemMetrics(),
    },
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
// AI ENGINE (CACHE + METRICS)
// =====================
app.post("/ai", async (req, res) => {
  try {
    const key = req.body.text;

    recordAIRequest();

    if (aiCache.has(key)) {
      recordCacheHit();

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
    res.json({
      reply: "⚠️ AI fallback active",
    });
  }
});

// =====================
// AI PRO (QUEUE + SAFE DB)
// =====================
app.post("/ai-pro", auth, async (req, res) => {
  try {
    const state = mongoose.connection.readyState;

    if (state !== 1) {
      queueJob(async () => {
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
      });

      return res.json({
        reply: "⚠️ Offline mode — request queued",
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
// AGENT SYSTEM
// =====================
app.post("/agent/create", auth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      queueJob(() =>
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
// CRON WORKERS
// =====================
cron.schedule("* * * * *", async () => {
  if (mongoose.connection.readyState !== 1) return;

  try {
    await runAgents();
  } catch (err) {
    console.error("Agent error:", err.message);
  }
});

// =====================
// DB FAILURE TRACKING
// =====================
setInterval(() => {
  if (mongoose.connection.readyState !== 1) {
    recordDBFailure();
  }
}, 10000);

// =====================
// START SERVER
// =====================
app.listen(PORT, () => {
  console.log(`🚀 AI OS v7 running on port ${PORT}`);
});
