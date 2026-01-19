// functions/create-job.js
const admin = require("firebase-admin");

try {
  admin.app();
} catch (e) {
  admin.initializeApp();
}

const BUILD_ID = "create-job-v1-2026-01-19-0001";

function pickPrompt(body) {
  const raw = body?.prompt ?? body?.text ?? body?.message ?? "";
  if (typeof raw === "string") return raw.trim();
  try {
    return JSON.stringify(raw).trim();
  } catch {
    return String(raw || "").trim();
  }
}

function getBearerToken(req) {
  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token || null;
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
    return res
      .status(405)
      .json({ ok: false, buildId: BUILD_ID, error: "Method not allowed" });
  }

  try {
    // ✅ Auth
    const token = getBearerToken(req);
    if (!token) {
      return res
        .status(401)
        .json({ ok: false, buildId: BUILD_ID, error: "Missing Bearer token" });
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (e) {
      return res
        .status(401)
        .json({ ok: false, buildId: BUILD_ID, error: "Invalid token" });
    }

    // ✅ Payload
    const body = req.body || {};
    const prompt = pickPrompt(body);

    const nNum = Number(body.n ?? 1);
    const n = Number.isFinite(nNum) && nNum > 0 ? Math.min(nNum, 4) : 1; // cap (opcional) evita abuso

    const size = typeof body.size === "string" ? body.size : "1024x1024";
    const model = typeof body.model === "string" ? body.model : "gpt-image-1";

    if (!prompt) {
      return res.status(400).json({
        ok: false,
        buildId: BUILD_ID,
        error: "Invalid payload: prompt requerido",
      });
    }

    // ✅ Create Firestore doc
    const docRef = admin.firestore().collection("imageJobs").doc();

    const now = admin.firestore.FieldValue.serverTimestamp();
    const job = {
      status: "queued",
      prompt,
      n,
      size,
      model,
      userId: decoded.uid, // ✅ server-only
      createdAt: now,
      updatedAt: now,
      buildId: BUILD_ID,
    };

    await docRef.set(job);

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
