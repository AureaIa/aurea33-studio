// functions/get-job.js
const admin = require("firebase-admin");

try {
  admin.app();
} catch (e) {
  admin.initializeApp();
}

const BUILD_ID = "get-job-v1-2026-01-19-0001";

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
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Max-Age", "3600");
    return res.status(204).send("");
  }

  res.set("Access-Control-Allow-Origin", "*");
  res.set("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ ok: false, buildId: BUILD_ID, error: "Method not allowed" });
  }

  try {
    // ✅ Auth (OBLIGATORIO)
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

    // ✅ jobId
    const jobId = String(req.query.jobId || "").trim();
    if (!jobId) {
      return res.status(400).json({
        ok: false,
        buildId: BUILD_ID,
        error: "jobId requerido",
      });
    }

    const docRef = admin.firestore().collection("imageJobs").doc(jobId);
    const snap = await docRef.get();

    // ✅ Anti-flicker pero seguro:
    // Si no existe, NO damos 404 para no romper UI, pero tampoco filtramos info.
    if (!snap.exists) {
      return res.status(200).json({
        ok: true,
        buildId: BUILD_ID,
        jobId,
        status: "queued",
        job: { status: "queued" },
      });
    }

    const job = snap.data() || {};

    // ✅ AUTHZ: si no es tuyo, NO lo puedes ver
    if (job.userId && job.userId !== decoded.uid) {
      // Importante: aquí sí devolvemos 403 (o puedes devolver queued si quieres “silencio”)
      return res.status(403).json({
        ok: false,
        buildId: BUILD_ID,
        error: "Forbidden",
      });
    }

    return res.status(200).json({
      ok: true,
      buildId: BUILD_ID,
      jobId,
      status: job.status || "processing",
      job,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      buildId: BUILD_ID,
      error: err?.message ? String(err.message) : "Unknown error",
    });
  }
};
