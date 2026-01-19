// functions/get-job.js
const admin = require("firebase-admin");

try {
  admin.app();
} catch (e) {
  admin.initializeApp();
}

const BUILD_ID = "get-job-v1-2026-01-09-0955";

module.exports = async (req, res) => {
  // ✅ CORS preflight
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Max-Age", "3600");
    return res.status(204).send("");
  }

  // ✅ CORS + no cache
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Cache-Control", "no-store");

  try {
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

    // ✅ FIX: en vez de 404, devolvemos queued para evitar “404 intermitente”
    if (!snap.exists) {
      return res.status(200).json({
        ok: true,
        buildId: BUILD_ID,
        jobId,
        status: "queued",
        job: {
          status: "queued",
          note: "Job aún no existe en Firestore; esperando creación.",
        },
      });
    }

    const job = snap.data() || {};

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
