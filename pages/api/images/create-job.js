// pages/api/images/create-job.js
export default async function handler(req, res) {
  // CORS (opcional, pero útil si luego llamas desde otro dominio)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const target = process.env.CREATE_IMAGE_URL;
  if (!target) return res.status(500).json({ ok: false, error: "Missing CREATE_IMAGE_URL" });

  try {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, error: "Missing Bearer token" });
    }

    const r = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth, // 🔥 passthrough token tal cual
      },
      body: JSON.stringify(req.body || {}),
    });

    const text = await r.text(); // leemos como texto para no romper si viene vacío
    res.status(r.status);

    // intenta regresar JSON si se puede
    try {
      return res.json(JSON.parse(text));
    } catch {
      return res.send(text);
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Proxy error" });
  }
}
