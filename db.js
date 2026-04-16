const mongoose = require("mongoose");

let retryCount = 0;
const MAX_RETRIES = 5;
let isConnected = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("❌ Missing MONGODB_URI");
    return;
  }

  try {
    await mongoose.connect(uri);
    isConnected = true;
    retryCount = 0;

    console.log("✅ MongoDB Connected");

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB disconnected");
      isConnected = false;
      reconnect();
    });

  } catch (err) {
    console.error("❌ MongoDB Connection Failed:", err.message);
    reconnect();
  }
}

function reconnect() {
  if (retryCount >= MAX_RETRIES) {
    console.log("⚠️ MongoDB in offline mode (max retries reached)");
    return;
  }

  retryCount++;

  const delay = Math.min(2000 * retryCount, 15000);

  console.log(`🔁 Retry MongoDB in ${delay / 1000}s`);

  setTimeout(connectDB, delay);
}

function dbReady() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDB, dbReady };
