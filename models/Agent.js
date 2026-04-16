const mongoose = require("mongoose");

const AgentSchema = new mongoose.Schema({
  userId: String,
  type: String,
  prompt: String,
  active: { type: Boolean, default: true },
  lastRun: Date
});

module.exports = mongoose.models.Agent || mongoose.model("Agent", AgentSchema);
