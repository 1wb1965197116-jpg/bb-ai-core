const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const askAI = async (messages) => {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
    }),
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "No response";
};

module.exports = { askAI };
