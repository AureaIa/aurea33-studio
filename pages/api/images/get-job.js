// pages/api/images/get-job.js

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const baseUrl =
      process.env.GET_IMAGE_URL ||
      process.env.NEXT_PUBLIC_GET_IMAGE_URL ||
      "";

    if (!baseUrl) {
      return res.status(500).json({ error: "Missing GET_IMAGE_URL in env" });
    }

    const jobId = String(req.query.jobId || "").trim();
    if (!jobId) return res.status(400).json({ error: "Missing jobId" });

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;

    if (!token) {
      return res.status(401).json({ error: "Missing Authorization Bearer token" });
    }

    // ✅ Construcción robusta de URL (soporta baseUrl con o sin ?)
    const joiner = baseUrl.includes("?") ? "&" : "?";
    const finalUrl = `${baseUrl}${joiner}jobId=${encodeURIComponent(jobId)}`;

    // ✅ Evita caches raros
    res.setHeader("Cache-Control", "no-store");

    const r = await fetch(finalUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // ✅ Intenta JSON, si no, lee texto
    const text = await r.text().catch(() => "");
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    // ✅ OPCIONAL: si tu Function manda 404 mientras el job aún no existe,
    // lo convertimos a "queued" para que el frontend no truene
    if (r.status === 404) {
      return res.status(200).json({
        status: "queued",
        jobId,
        note: "Job not found yet (404 from upstream) — treating as queued",
        urlUsed: baseUrl,
      });
    }

    return res.status(r.status).json({ ...data, urlUsed: baseUrl });
  } catch (err) {
    console.error("get-job proxy error:", err);
    return res.status(500).json({ error: err?.message || "Unknown error" });
  }
}
