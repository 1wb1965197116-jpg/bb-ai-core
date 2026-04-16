const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: String,
  password: String,
  pro: { type: Boolean, default: false },
  stripeCustomerId: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", UserSchema);
