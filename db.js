const mongoose = require("mongoose");

let isConnected = false;
let retryCount = 0;
const MAX_RETRIES = 10;

async function connectDB() {
  if (isConnected) {
    console.log("⚡ Mongo already connected");
    return;
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri) {
    console.error("❌ MongoDB URI missing (MONGODB_URI)");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);

    isConnected = true;
    retryCount = 0;

    console.log("✅ MongoDB Connected");

    // Handle runtime disconnects
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
    console.error("💥 MongoDB max retries reached — exiting process");
    process.exit(1);
  }

  retryCount++;

  const delay = Math.min(1000 * retryCount * 2, 30000);

  console.log(`🔁 Reconnecting MongoDB in ${delay / 1000}s (attempt ${retryCount})`);

  setTimeout(connectDB, delay);
}

module.exports = { connectDB };
