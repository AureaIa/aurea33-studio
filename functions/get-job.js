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
    return res.status(204).send("");
  }

  res.set("Access-Control-Allow-Origin", "*");

  try {
    const jobId = (req.query.jobId || "").trim();
    if (!jobId) {
      return res.status(400).json({ ok: false, buildId: BUILD_ID, error: "jobId requerido" });
    }

    const docRef = admin.firestore().collection("imageJobs").doc(jobId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(404).json({
        ok: false,
        buildId: BUILD_ID,
        error: "Job not found",
        lookedIn: "imageJobs",
        jobId,
      });
    }

    return res.status(200).json({
      ok: true,
      buildId: BUILD_ID,
      jobId,
      job: snap.data(),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      buildId: BUILD_ID,
      error: err?.message ? String(err.message) : "Unknown error",
    });
  }
};
