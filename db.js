// =====================
// 🔐 LOCKED DB CONNECTION
// =====================
const mongoose = require("mongoose");

let isConnected = false;

// =====================
// VALIDATE URI
// =====================
function validateMongoURI(uri) {
  if (!uri) {
    throw new Error("❌ MONGO_URI is missing from environment variables");
  }

  if (
    !uri.startsWith("mongodb://") &&
    !uri.startsWith("mongodb+srv://")
  ) {
    throw new Error("❌ Invalid MongoDB URI format");
  }

  if (uri.includes("clustero") || uri.includes("cluster0o")) {
    throw new Error("❌ Invalid cluster hostname (typo detected)");
  }

  if (!uri.includes("@")) {
    throw new Error("❌ Missing username/password in URI");
  }

  if (!uri.includes(".mongodb.net")) {
    throw new Error("❌ Invalid MongoDB host");
  }

  console.log("✅ Mongo URI validated");
}

// =====================
// CONNECT FUNCTION
// =====================
async function connectDB() {
  const uri = process.env.MONGO_URI;

  try {
    validateMongoURI(uri);

    if (isConnected) {
      console.log("⚡ Using existing MongoDB connection");
      return;
    }

    console.log("🔌 Connecting to MongoDB...");

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;

    console.log(
      `✅ MongoDB Connected → ${conn.connection.host}`
    );
  } catch (err) {
    console.error("❌ MongoDB Error:", err.message);

    // adaptive retry
    const retryTime = Math.min(10000, 3000 + Math.random() * 4000);

    console.log(`🔁 Retrying in ${Math.floor(retryTime / 1000)}s...`);

    setTimeout(connectDB, retryTime);
  }
}

// =====================
// CONNECTION EVENTS
// =====================
mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB disconnected");
  isConnected = false;
});

mongoose.connection.on("error", (err) => {
  console.error("💥 MongoDB crash:", err.message);
});

module.exports = { connectDB };
