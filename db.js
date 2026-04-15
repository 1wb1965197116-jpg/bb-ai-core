const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URL);

const UserSchema = new mongoose.Schema({
  email: String,
  password: String,
  pro: Boolean,
  stripeCustomerId: String
});

const ChatSchema = new mongoose.Schema({
  email: String,
  messages: Array
});

const User = mongoose.model("User", UserSchema);
const Chat = mongoose.model("Chat", ChatSchema);

module.exports = { User, Chat };
