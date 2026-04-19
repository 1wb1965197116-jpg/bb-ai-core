const mongoose = require("mongoose");

// =====================
// 🔒 GLOBAL CACHE (prevents multiple connections)
// =====================
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

// =====================
// 🔗 CONNECT FUNCTION
// =====================
const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is missing");
    return;
  }

  // Already connected
  if (cached.conn) {
    return cached.conn;
  }

  // Create connection once
  if (!cached.promise) {
    console.log("🔌 Connecting to MongoDB...");

    cached.promise = mongoose.connect(process.env.MONGO_URI, {
      dbName: "bb-ai-core", // optional but recommended
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }

  try {
    cached.conn = await cached.promise;
    console.log("✅ MongoDB Connected");
    return cached.conn;
  } catch (err) {
    console.error("❌ MongoDB Error:", err.message);
    cached.promise = null;

    // retry after delay
    setTimeout(connectDB, 5000);
  }
};

// =====================
// 📡 CONNECTION EVENTS
// =====================
mongoose.connection.on("connected", () => {
  console.log("📡 MongoDB connection established");
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("💥 MongoDB crash:", err.message);
});

// =====================
// 🚀 EXPORT
// =====================
module.exports = { connectDB };
