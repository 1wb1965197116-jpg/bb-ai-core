require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cron = require("node-cron");

const { connectDB, User, Chat, Agent } = require("./db");

connectDB();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// =====================
// MIDDLEWARE
// =====================
app.use(cors());
app.use(express.json());

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
// HOME
// =====================
app.get("/", (req, res) => {
  res.send("BB AI SAAS RUNNING 🚀");
});

// =====================
// REGISTER
// =====================
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  await User.create({ email, password: hashed });

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
// SIMPLE AI
// =====================
async function askAI(text) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: text }]
    })
  });

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "No response";
}

// =====================
// PUBLIC AI
// =====================
app.post("/ai", async (req, res) => {
  const reply = await askAI(req.body.text || "");
  res.json({ reply });
});

// =====================
// CREATE AGENT
// =====================
app.post("/agent/create", auth, async (req, res) => {
  const { type, prompt } = req.body;

  await Agent.create({
    email: req.user.email,
    type,
    prompt
  });

  res.json({ message: "Agent created" });
});

// =====================
// RUN AGENTS (AUTO)
// =====================
cron.schedule("* * * * *", async () => {
  const agents = await Agent.find();

  for (let a of agents) {
    let prompt = a.prompt;

    const result = await askAI(prompt);

    a.lastRun = new Date();
    await a.save();

    console.log("🤖 Agent:", a.email, result);
  }
});

// =====================
// START SERVER
// =====================
app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
