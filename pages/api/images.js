// pages/api/images.js
import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { prompt } = req.body || {};
    if (!prompt?.trim()) {
      return res.status(400).json({ error: "prompt requerido" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY no está definida" });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Generación de imagen (base64)
    const img = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    });

    const b64 = img?.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(500).json({
        error: "No llegó b64_json en respuesta",
        raw: img,
      });
    }

    return res.status(200).json({ b64 });
  } catch (e) {
    console.error("IMAGES ERROR:", e);

    // Errores del SDK suelen traer status + message
    const status = e?.status || 500;
    const message =
      e?.message ||
      e?.error?.message ||
      "Server error";

    return res.status(status).json({ error: message });
  }
}
