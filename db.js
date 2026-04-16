const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;

async function connectDB() {
  if (!MONGO_URI) {
    console.log("⚠️ MONGO_URI missing — running without database");
    return;
  }

  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });

    console.log("✅ MongoDB connected");
  } catch (err) {
    console.log("❌ MongoDB connection failed:");
    console.log(err.message);
  }
}

module.exports = connectDB;
