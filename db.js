const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI missing in environment variables");
  process.exit(1);
}

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("✅ MongoDB Connected Successfully");
  } catch (err) {
    console.error("❌ MongoDB Connection Failed:", err.message);
    process.exit(1);
  }
}

// Models
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  pro: { type: Boolean, default: false },
});

const chatSchema = new mongoose.Schema({
  email: String,
  messages: Array,
});

const User = mongoose.model("User", userSchema);
const Chat = mongoose.model("Chat", chatSchema);

module.exports = { connectDB, User, Chat };
