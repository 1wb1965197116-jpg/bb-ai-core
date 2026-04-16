const mongoose = require("mongoose");

const AgentSchema = new mongoose.Schema({
  userId: String,
  type: String,
  prompt: String,
  active: { type: Boolean, default: true },
  lastRun: Date,
  interval: { type: Number, default: 60 } // minutes
});

module.exports = mongoose.model("Agent", AgentSchema);
