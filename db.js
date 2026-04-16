const mongoose = require("mongoose");

const state = {
  retry: 0,
  lastError: null,
  mode: "offline",
};

const MAX_RETRIES = 6;

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("❌ Missing MONGODB_URI");
    state.mode = "offline";
    return;
  }

  try {
    await mongoose.connect(uri);

    state.retry = 0;
    state.lastError = null;
    state.mode = "online";

    console.log("✅ MongoDB Connected (AI OS v5)");

  } catch (err) {
    state.lastError = err.message;
    state.mode = "offline";

    console.error("❌ MongoDB Error:", err.message);

    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (state.retry >= MAX_RETRIES) {
    console.log("⚠️ MongoDB locked in OFFLINE mode (max retries reached)");
    return;
  }

  state.retry++;

  const delay = Math.min(3000 * state.retry, 20000);

  console.log(`🔁 DB reconnect in ${delay / 1000}s (attempt ${state.retry})`);

  setTimeout(connectDB, delay);
}

function dbReady() {
  return mongoose.connection.readyState === 1;
}

function dbMode() {
  return {
    mode: dbReady() ? "online" : "offline",
    retry: state.retry,
    lastError: state.lastError,
  };
}

module.exports = { connectDB, dbReady, dbMode };
