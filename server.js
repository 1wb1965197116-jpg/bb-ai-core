require("dotenv").config();

// =====================
// IMPORTS
// =====================
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cron = require("node-cron");
const mongoose = require("mongoose");

// DB + MODELS
const { connectDB } = require("./db");
const User = require("./models/User");
const Chat = require("./models/Chat");
const Agent = require("./models/Agent");

// SERVICES
const { askAI } = require("./services/ai");
const { createCheckout, handleStripeEvent } = require("./services/stripe");
const { runAgents } = require("./services/worker");

// =====================
// INIT APP
// =====================
const app = express();
const PORT = process.env.PORT || 10000;

// =====================
// GLOBAL DB CONNECT
// =====================
(async () => {
  await connectDB();
})();

// =====================
// MONGO EVENTS (HEALTH)
// =====================
mongoose.connection.on("connected", () => {
  console.log("🟢 MongoDB Connected");
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB Disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("🔴 MongoDB Error:", err.message);
});

// =====================
// MIDDLEWARE
// =====================
app.use(cors());
app.use(express.json());

// =====================
// STRIPE WEBHOOK (MUST BE RAW)
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
      console.error("Stripe webhook error:", err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// AFTER WEBHOOK (JSON PARSER SAFE)
app.use(express.json());

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
// HEALTH CHECK
// =====================
app.get("/", (req, res) => {
  res.send("🚀 BB AI LEVEL 3 LIVE");
});

app.get("/health", (req, res) => {
  const state = mongoose.connection.readyState;

  res.json({
    status: "OK",
    db:
      state === 1
        ? "connected"
        : state === 2
        ? "connecting"
        : "disconnected",
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
// AI (PUBLIC)
// =====================
app.post("/ai", async (req, res) => {
  try {
    const reply = await askAI([
      { role: "user", content: req.body.text },
    ]);

    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// AI PRO (MEMORY)
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// AGENTS
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
// STRIPE SUBSCRIPTION
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
// CRON JOB (SAFE)
// =====================
cron.schedule("* * * * *", async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log("⏳ Skipping agents — DB not ready");
      return;
    }

    console.log("⏱ Running AI agents...");
    await runAgents();
  } catch (err) {
    console.error("Agent error:", err.message);
  }
});

// =====================
// GLOBAL ERROR HANDLING
// =====================
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.error("💥 Unhandled Rejection:", err?.message || err);
});

// =====================
// START SERVER
// =====================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
