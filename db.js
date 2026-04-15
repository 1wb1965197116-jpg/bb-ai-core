const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    email: String,
    password: String,
    pro: { type: Boolean, default: false }
});

const ChatSchema = new mongoose.Schema({
    email: String,
    messages: [
        {
            role: String,
            content: String
        }
    ]
});

const User = mongoose.model("User", UserSchema);
const Chat = mongoose.model("Chat", ChatSchema);

module.exports = { User, Chat };
