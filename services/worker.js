const Agent = require("../models/Agent");
const { askAI } = require("./ai");

const runAgents = async () => {
  const agents = await Agent.find();

  for (let agent of agents) {
    try {
      let system = "You are a helpful AI.";

      if (agent.type === "business")
        system = "Generate profitable business ideas.";
      if (agent.type === "money")
        system = "Generate ways to make money online.";

      const reply = await askAI([
        { role: "system", content: system },
        { role: "user", content: agent.prompt || "Run task" },
      ]);

      console.log("🤖 Agent:", reply);
    } catch (err) {
      console.error("Agent error:", err.message);
    }
  }
};

module.exports = { runAgents };
