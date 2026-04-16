const mongoose = require("mongoose");

let state = {
  connected: false,
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

    state.connected = true;
    state.retry = 0;
    state.lastError = null;

    console.log("✅ MongoDB Connected (v4 system)");

  } catch (err) {
    state.connected = false;
    state.lastError = err.message;

    console.error("❌ Mongo connect failed:", err.message);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (state.retry >= MAX_RETRIES) {
    console.log("⚠️ MongoDB locked in offline mode (max retries reached)");
    return;
  }

  state.retry++;

  const delay = Math.min(2000 * state.retry, 20000);

  console.log(`🔁 Auto-repair MongoDB in ${delay / 1000}s (attempt ${state.retry})`);

  setTimeout(connectDB, delay);
}

// 🔥 LIVE STATUS CHECKER (NEW)
setInterval(() => {
  const ready = mongoose.connection.readyState === 1;

  state.connected = ready;

}, 5000);

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
