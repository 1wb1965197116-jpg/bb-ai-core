require("dotenv").config();

const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cron = require("node-cron");

const { User, Chat, connectDB } = require("./db");

connectDB();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// =====================
// MEMORY (TEMP AGENTS)
// =====================
let agents = [];

// =====================
// STRIPE WEBHOOK (MUST BE FIRST)
// =====================
app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const event = JSON.parse(req.body.toString());

      if (event.type === "checkout.session.completed") {
        const email = event.data.object.customer_email;

        await User.findOneAndUpdate({ email }, { pro: true });

        console.log("🔥 PRO UNLOCKED:", email);
      }

      res.json({ received: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// =====================
// MIDDLEWARE
// =====================
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// =====================
// AUTH MIDDLEWARE
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
// HEALTH CHECK
// =====================
app.get("/", (req, res) => {
  res.send("BB AI CORE LIVE 🚀");
});

// =====================
// REGISTER
// =====================
app.post("/register", async (req, res) => {
  try {
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

// =====================
// LOGIN
// =====================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.json({ error: "Wrong password" });

    const token = jwt.sign({ email }, JWT_SECRET);

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// STRIPE SUBSCRIPTION
// =====================
app.post("/create-subscription", async (req, res) => {
  try {
    const { email } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "BB AI Pro",
            },
            unit_amount: 999,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      success_url: "https://bb-ai-core.onrender.com/success",
      cancel_url: "https://bb-ai-core.onrender.com/cancel",
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/success", (req, res) => {
  res.send("Payment successful 🎉 Pro will unlock shortly.");
});

app.get("/cancel", (req, res) => {
  res.send("Payment cancelled");
});

// =====================
// OPENAI HELPER
// =====================
async function askAI(messages) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
    }),
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "No response";
}

// =====================
// PUBLIC AI
// =====================
app.post("/ai-reply-public", async (req, res) => {
  try {
    const text = req.body?.text || "";

    const reply = await askAI([
      { role: "user", content: text },
    ]);

    res.json({ reply });
  } catch (err) {
    res.json({ reply: err.message });
  }
});

// =====================
// PRO AI (MEMORY)
// =====================
app.post("/ai-reply", auth, async (req, res) => {
  try {
    const { text } = req.body;
    const email = req.user.email;

    if (!text) return res.json({ reply: "Send text 🤖" });

    let chat = await Chat.findOne({ email });
    if (!chat) chat = new Chat({ email, messages: [] });

    if (chat.messages.length > 20) chat.messages.shift();

    chat.messages.push({ role: "user", content: text });

    const reply = await askAI(chat.messages);

    chat.messages.push({ role: "assistant", content: reply });

    await chat.save();

    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// CREATE AGENT
// =====================
app.post("/agent/create", auth, (req, res) => {
  const { type, prompt } = req.body;
  const email = req.user.email;

  agents.push({
    id: Date.now(),
    email,
    type,
    prompt,
  });

  res.json({ message: "Agent created" });
});

// =====================
// AUTO RUN AGENTS (EVERY MINUTE)
// =====================
cron.schedule("* * * * *", async () => {
  console.log("⏱ Running agents...");

  for (let agent of agents) {
    try {
      let system = "You are a helpful AI assistant.";

      if (agent.type === "business")
        system = "Generate profitable business ideas.";
      if (agent.type === "money")
        system = "Generate ways to make money online.";
      if (agent.type === "email")
        system = "Write high-converting business emails.";

      const result = await askAI([
        { role: "system", content: system },
        { role: "user", content: agent.prompt || "Run task" },
      ]);

      console.log("🤖 Agent Result:", result);
    } catch (err) {
      console.error("Agent error:", err.message);
    }
  }
});

// =====================
// START SERVER
// =====================
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
