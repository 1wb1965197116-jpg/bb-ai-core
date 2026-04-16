const mongoose = require("mongoose");

async function connectDB() {
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI missing");
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Error:", err.message);
  }
}

const UserSchema = new mongoose.Schema({
  email: String,
  password: String,
  pro: { type: Boolean, default: false }
});

const ChatSchema = new mongoose.Schema({
  email: String,
  messages: Array
});

const AgentSchema = new mongoose.Schema({
  email: String,
  type: String,
  prompt: String,
  lastRun: Date
});

const User = mongoose.model("User", UserSchema);
const Chat = mongoose.model("Chat", ChatSchema);
const Agent = mongoose.model("Agent", AgentSchema);

module.exports = {
  connectDB,
  User,
  Chat,
  Agent
};
