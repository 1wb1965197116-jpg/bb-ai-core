const mongoose = require("mongoose");

let isConnected = false;

async function connectDB() {
  if (isConnected) {
    console.log("⚡ Mongo already connected");
    return;
  }

  try {
    const uri = process.env.MONGO_URI;

    if (!uri) {
      console.error("❌ MONGO_URI is missing");
      return;
    }

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    isConnected = true;
    console.log("✅ MongoDB Connected");

  } catch (err) {
    console.error("❌ MongoDB Error:", err.message);

    // 🔁 AUTO RETRY EVERY 5 SECONDS
    setTimeout(connectDB, 5000);
  }
}

module.exports = { connectDB };
