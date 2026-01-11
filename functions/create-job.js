const { db } = require("./firebase");
const { v4: uuid } = require("uuid");

exports.createJob = async (req, res) => {
  try {
    const { prompt, size = "1024x1024", userId } = req.body || {};
    if (!prompt || !userId) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const jobId = uuid();

    await db.collection("imageJobs").doc(jobId).set({
      jobId,
      userId,
      prompt,
      size,
      status: "queued",
      createdAt: Date.now(),
    });

    return res.json({ jobId });
  } catch (e) {
    console.error("CREATE JOB ERROR:", e);
    res.status(500).json({ error: "Create job failed" });
  }
};
