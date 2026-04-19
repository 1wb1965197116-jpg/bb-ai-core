const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: String,
  password: String,
  pro: { type: Boolean, default: false },
  usage: { type: Number, default: 0 },
});

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);
