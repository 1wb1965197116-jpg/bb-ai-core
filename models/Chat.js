const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema({
  userId: String,
  messages: Array,
});

module.exports = mongoose.models.Chat || mongoose.model("Chat", ChatSchema);
