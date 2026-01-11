// pages/api/chat.js
export default async function handler(req, res) {
  try {
    const { messages, mode } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages inválido" });
    }

    const model = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: mode === "code" ? 0.2 : 0.7,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(400).json({ error: data?.error?.message || "OpenAI error" });
    }

    const reply = data?.choices?.[0]?.message?.content || "Listo ✅";
    return res.status(200).json({ reply });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
