// functions/create-job.js
const admin = require("firebase-admin");

try {
  admin.app();
} catch (e) {
  admin.initializeApp();
}

const BUILD_ID = "create-job-v1-2026-01-13-0001";

function pickPrompt(body) {
  const raw = body?.prompt ?? body?.text ?? body?.message ?? "";
  if (typeof raw === "string") return raw.trim();
  // si te llega algo raro (objeto), lo convertimos a string seguro
  try {
    return JSON.stringify(raw).trim();
  } catch {
    return String(raw || "").trim();
  }
}

module.exports = async (req, res) => {
  // ✅ CORS preflight
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Max-Age", "3600");
    return res.status(204).send("");
  }

  res.set("Access-Control-Allow-Origin", "*");
  res.set("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, buildId: BUILD_ID, error: "Method not allowed" });
  }

  try {
    // ✅ Verifica token Firebase
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;

    if (!token) {
      return res.status(401).json({ ok: false, buildId: BUILD_ID, error: "Missing Bearer token" });
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (e) {
      return res.status(401).json({ ok: false, buildId: BUILD_ID, error: "Invalid token" });
    }

    // ✅ Lee payload
    const body = req.body || {};
    const prompt = pickPrompt(body);
    const n = Number.isFinite(body.n) ? body.n : Number(body.n || 1);
    const size = typeof body.size === "string" ? body.size : "1024x1024";
    const model = typeof body.model === "string" ? body.model : "gpt-image-1";

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        ok: false,
        buildId: BUILD_ID,
        error: "Invalid payload: prompt requerido",
        received: { body },
      });
    }

    // ✅ Crea doc en Firestore (MISMA colección que get-job)
    const docRef = admin.firestore().collection("imageJobs").doc();

    const job = {
      status: "queued",
      prompt,
      n: Number.isFinite(n) && n > 0 ? n : 1,
      size,
      model,
      userId: decoded.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      buildId: BUILD_ID,
    };

    await docRef.set(job);

    // ✅ Respuesta standard para tu proxy/UI
    return res.status(200).json({
      ok: true,
      buildId: BUILD_ID,
      jobId: docRef.id,
      status: "queued",
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      buildId: BUILD_ID,
      error: err?.message ? String(err.message) : "Unknown error",
    });
  }
};
