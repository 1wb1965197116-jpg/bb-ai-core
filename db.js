const mongoose = require("mongoose");

const state = {
  retry: 0,
  lastError: null,
  reliabilityScore: 100,
};

const MAX_RETRIES = 8;

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("❌ Missing MONGODB_URI");
    state.reliabilityScore = 0;
    return;
  }

  try {
    await mongoose.connect(uri);

    state.retry = 0;
    state.lastError = null;
    state.reliabilityScore = 100;

    console.log("✅ MongoDB Connected (AI OS v6)");

  } catch (err) {
    state.lastError = err.message;
    state.reliabilityScore -= 10;

    console.error("❌ MongoDB Error:", err.message);

    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (state.retry >= MAX_RETRIES) {
    console.log("⚠️ DB locked in degraded mode (v6 safeguard)");
    return;
  }

  state.retry++;

  // 🔥 Adaptive backoff (smarter than fixed delay)
  const delay = Math.min(2000 * Math.pow(1.5, state.retry), 30000);

  console.log(`🔁 Adaptive reconnect in ${Math.round(delay / 1000)}s`);

  setTimeout(connectDB, delay);
}

function dbReady() {
  return mongoose.connection.readyState === 1;
}

function dbHealth() {
  return {
    connected: dbReady(),
    retry: state.retry,
    reliabilityScore: state.reliabilityScore,
    lastError: state.lastError,
  };
}

module.exports = { connectDB, dbReady, dbHealth };
