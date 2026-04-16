const mongoose = require("mongoose");

let state = {
  retry: 0,
  lastError: null,
};

const MAX_RETRIES = 6;

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("❌ Missing MONGODB_URI");
    return;
  }

  try {
    await mongoose.connect(uri);

    state.retry = 0;
    state.lastError = null;

    console.log("✅ MongoDB Connected (stable mode)");

  } catch (err) {
    state.lastError = err.message;
    console.error("❌ MongoDB Error:", err.message);

    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (state.retry >= MAX_RETRIES) {
    console.log("⚠️ MongoDB offline mode locked (max retries reached)");
    return;
  }

  state.retry++;

  const delay = Math.min(2000 * state.retry, 20000);

  console.log(`🔁 Reconnecting MongoDB in ${delay / 1000}s`);

  setTimeout(connectDB, delay);
}

function dbReady() {
  return mongoose.connection.readyState === 1;
}

function dbState() {
  return {
    connected: dbReady(),
    retry: state.retry,
    lastError: state.lastError,
  };
}

module.exports = { connectDB, dbReady, dbState };
