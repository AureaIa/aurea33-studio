// pages/api/images/create-job.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const url =
      process.env.CREATE_IMAGE_URL ||
      process.env.NEXT_PUBLIC_CREATE_IMAGE_URL ||
      "";

    if (!url) {
      return res.status(500).json({ error: "Missing CREATE_IMAGE_URL in env" });
    }

    const body = req.body || {};

    // ✅ Captura prompt aunque venga con otras keys
    const promptRaw = body.prompt ?? body.text ?? body.message ?? "";
    const prompt = typeof promptRaw === "string" ? promptRaw.trim() : promptRaw;

    const n = body.n ?? 1;
    const size = body.size ?? "1024x1024";
    const model = body.model ?? "gpt-image-1";

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;

    if (!token) {
      return res.status(401).json({
        error: "Missing Authorization Bearer token",
        debug: {
          contentType: req.headers["content-type"],
          receivedBody: body,
        },
      });
    }

    // ✅ Reenvío a Cloud Function
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt, n, size, model }),
    });

    const upstreamText = await upstream.text().catch(() => "");
    let upstreamJson = null;
    try {
      upstreamJson = upstreamText ? JSON.parse(upstreamText) : null;
    } catch {
      upstreamJson = null;
    }

    return res.status(upstream.status).json({
      ...(upstreamJson || {}),
      debug: {
        urlUsed: url,
        upstreamStatus: upstream.status,
        upstreamText,
        contentType: req.headers["content-type"],
        receivedBody: body,
        forwardedBody: { prompt, n, size, model },
        promptType: typeof prompt,
      },
    });
  } catch (err) {
    console.error("create-job proxy error:", err);
    return res.status(500).json({ error: err?.message || "Unknown error" });
  }
}
