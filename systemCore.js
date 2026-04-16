const mongoose = require("mongoose");

const systemState = {
  healthScore: 100,
  dbFailures: 0,
  aiRequests: 0,
  cacheHits: 0,
};

function recordDBFailure() {
  systemState.dbFailures++;
  systemState.healthScore -= 5;
}

function recordAIRequest() {
  systemState.aiRequests++;
}

function recordCacheHit() {
  systemState.cacheHits++;
}

function getSystemMetrics() {
  return {
    ...systemState,
    dbStatus: mongoose.connection.readyState === 1 ? "online" : "offline",
  };
}

module.exports = {
  recordDBFailure,
  recordAIRequest,
  recordCacheHit,
  getSystemMetrics,
};
