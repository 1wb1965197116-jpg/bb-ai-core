require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const { connectDB } = require("./db");
const User = require("./models/User");
const Chat = require("./models/Chat");
const Agent = require("./models/Agent");

const { askAI } = require("./services/ai");
const { createCheckout, handleStripeEvent } = require("./services/stripe");
const { runAgents } = require("./services/worker");

const cron = require("node-cron");

connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

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

// STRIPE WEBHOOK
app.post("/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const event = JSON.parse(req.body.toString());
  await handleStripeEvent(event);
  res.json({ received: true });
});

// AI
app.post("/ai", async (req, res) => {
  const reply = await askAI([{ role: "user", content: req.body.text }]);
  res.json({ reply });
});

// PRO AI
app.post("/ai-pro", auth, async (req, res) => {
  let chat = await Chat.findOne({ userId: req.user.email });

  if (!chat) chat = new Chat({ userId: req.user.email, messages: [] });

  chat.messages.push({ role: "user", content: req.body.text });

  const reply = await askAI(chat.messages);

  chat.messages.push({ role: "assistant", content: reply });

  await chat.save();

  res.json({ reply });
});

// AGENT CREATE
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

// CRON (every minute worker)
cron.schedule("* * * * *", runAgents);

// START
app.listen(PORT, () => {
  console.log("🚀 SaaS Level 2 Running on", PORT);
});
