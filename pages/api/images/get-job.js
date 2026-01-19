// pages/api/images/get-job.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const targetBase = process.env.GET_IMAGE_URL;
  if (!targetBase) return res.status(500).json({ ok: false, error: "Missing GET_IMAGE_URL" });

  try {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, error: "Missing Bearer token" });
    }

    const jobId = String(req.query.jobId || "").trim();
    if (!jobId) return res.status(400).json({ ok: false, error: "jobId requerido" });

    // 🔥 Pasamos jobId como querystring a tu Cloud Function
    const url = `${targetBase}?jobId=${encodeURIComponent(jobId)}`;

    const r = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: auth,
      },
    });

    const text = await r.text();
    res.status(r.status);

    try {
      return res.json(JSON.parse(text));
    } catch {
      return res.send(text);
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Proxy error" });
  }
}
