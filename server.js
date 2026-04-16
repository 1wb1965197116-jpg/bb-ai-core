require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cron = require("node-cron");

const { User, Chat } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// =====================
// SAFE MONGO CONNECT
// =====================
async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error("❌ MONGO_URI missing in environment variables");
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Connection Failed:", err.message);
  }
}

connectDB();

// =====================
// MIDDLEWARE
// =====================
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// =====================
// HEALTH CHECK
// =====================
app.get("/", (req, res) => {
  res.send("BB AI CORE RUNNING 🚀");
});

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
// AI ROUTE (SAFE)
// =====================
app.post("/ai-reply-public", async (req, res) => {
  try {
    const text = req.body?.text || "";

    if (!process.env.OPENAI_API_KEY) {
      return res.json({ reply: "Missing OPENAI_API_KEY" });
    }

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

    res.json({
      reply: data?.choices?.[0]?.message?.content || "No response"
    });

  } catch (err) {
    res.json({ reply: "AI Error: " + err.message });
  }
});

// =====================
// START SERVER (LAST)
// =====================
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
