const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Chat } = require("./db");

const app = express();
const JWT_SECRET = process.env.JWT_SECRET;

// ⚠️ Stripe webhook must come BEFORE json middleware
app.post("/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const event = JSON.parse(req.body);

  if (event.type === "checkout.session.completed") {
    const email = event.data.object.customer_email;

    await User.findOneAndUpdate({ email }, { pro: true });
    console.log("🔥 PRO UNLOCKED:", email);
  }

  res.json({ received: true });
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

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
// REGISTER
// =====================
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  await User.create({
    email,
    password: hashed
  });

  res.json({ message: "User created" });
});

// =====================
// LOGIN
// =====================
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.json({ error: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.json({ error: "Wrong password" });

  const token = jwt.sign({ email }, JWT_SECRET);
  res.json({ token });
});

// =====================
// STRIPE CHECKOUT
// =====================
app.post("/create-subscription", async (req, res) => {
  const { email } = req.body;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    customer_email: email,
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: "BB AI Pro" },
        unit_amount: 999,
        recurring: { interval: "month" }
      },
      quantity: 1
    }],
    success_url: "https://bb-ai-core.onrender.com/success",
    cancel_url: "https://bb-ai-core.onrender.com/cancel"
  });

  res.json({ url: session.url });
});

// =====================
// 🤖 AI WITH MEMORY
// =====================
app.post("/ai-reply", auth, async (req, res) => {
  const { text } = req.body;
  const email = req.user.email;

  let chat = await Chat.findOne({ email });

  if (!chat) {
    chat = new Chat({ email, messages: [] });
  }

  if (chat.messages.length > 20) {
    chat.messages.shift();
  }

  chat.messages.push({ role: "user", content: text });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: chat.messages
    })
  });

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content;

  chat.messages.push({ role: "assistant", content: reply });
  await chat.save();

  res.json({ reply });
});

// =====================
// PUBLIC TEST AI
// =====================
app.post("/ai-reply-public", async (req, res) => {
  const text = req.body?.text || "";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
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
});

// =====================
app.get("/", (req, res) => {
  res.send("BB AI PRO LIVE 🚀");
});

app.listen(process.env.PORT || 3000);
