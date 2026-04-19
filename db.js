const mongoose = require("mongoose");

let isConnected = false;

const connectDB = async () => {
  try {
    if (isConnected) {
      console.log("⚡ Mongo already connected");
      return;
    }

    if (!process.env.MONGO_URI) {
      throw new Error("❌ MONGO_URI missing");
    }

    console.log("🔌 Connecting to MongoDB...");

    await mongoose.connect(process.env.MONGO_URI);

    isConnected = true;

    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Error:", err.message);

    setTimeout(connectDB, 5000);
  }
};

module.exports = { connectDB };
