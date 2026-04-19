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

console.log("🔍 MONGO_URI:", process.env.MONGO_URI ? "FOUND" : "MISSING");

// CONNECT DB
connectDB();

// STRIPE WEBHOOK FIRST
app.post("/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const event = JSON.parse(req.body.toString());
  await handleStripeEvent(event);
  res.json({ received: true });
});

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// AUTH
function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

// HEALTH
app.get("/", (req, res) => {
  res.send("🚀 BB AI LEVEL 3 LIVE");
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// REGISTER
app.post("/register", async (req, res) => {
  const bcrypt = require("bcryptjs");
  const { email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);
  await User.create({ email, password: hashed });

  res.json({ message: "User created" });
});

// LOGIN
app.post("/login", async (req, res) => {
  const bcrypt = require("bcryptjs");
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.json({ error: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.json({ error: "Wrong password" });

  const token = jwt.sign({ email }, process.env.JWT_SECRET);
  res.json({ token });
});

// AI FREE (LIMITED)
app.post("/ai", async (req, res) => {
  const reply = await askAI([{ role: "user", content: req.body.text }]);
  res.json({ reply });
});

// AI PRO (TRACK USAGE)
app.post("/ai-pro", auth, async (req, res) => {
  const user = await User.findOne({ email: req.user.email });

  if (!user.pro && user.usage > 20) {
    return res.json({ reply: "Upgrade to Pro 🚀" });
  }

  let chat = await Chat.findOne({ userId: user.email });
  if (!chat) chat = new Chat({ userId: user.email, messages: [] });

  chat.messages.push({ role: "user", content: req.body.text });

  const reply = await askAI(chat.messages);

  chat.messages.push({ role: "assistant", content: reply });

  await chat.save();

  user.usage += 1;
  await user.save();

  res.json({ reply });
});

// AGENTS
app.post("/agent/create", auth, async (req, res) => {
  await Agent.create({
    userId: req.user.email,
    type: req.body.type,
    prompt: req.body.prompt,
  });

  res.json({ message: "Agent created" });
});

// STRIPE
app.post("/create-subscription", async (req, res) => {
  const session = await createCheckout(req.body.email);
  res.json({ url: session.url });
});

// CRON
cron.schedule("* * * * *", runAgents);

// START
app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});
