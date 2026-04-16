const Agent = require("../models/Agent");
const { askAI } = require("./ai");

async function runAgents() {
  const agents = await Agent.find({ active: true });

  for (let agent of agents) {
    try {
      const result = await askAI([
        {
          role: "system",
          content:
            agent.type === "business"
              ? "Generate profitable business ideas."
              : agent.type === "money"
              ? "Generate ways to make money online."
              : "Write professional emails."
        },
        {
          role: "user",
          content: agent.prompt
        }
      ]);

      agent.lastRun = new Date();
      await agent.save();

      console.log("🤖 Agent Run:", result);
    } catch (err) {
      console.error("Agent error:", err.message);
    }
  }
}

module.exports = { runAgents };
