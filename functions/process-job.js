const OpenAI = require("openai");
const { db, storage } = require("./firebase");

exports.processJob = async (jobId) => {
  // ✅ crear cliente adentro (runtime)
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const ref = db.collection("imageJobs").doc(jobId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const job = snap.data();
  await ref.update({ status: "processing" });

  try {
    const img = await openai.images.generate({
      model: "gpt-image-1",
      prompt: job.prompt,
      size: job.size || "1024x1024",
    });

    const b64 = img?.data?.[0]?.b64_json;
    if (!b64) throw new Error("No llegó b64_json");

    const buffer = Buffer.from(b64, "base64");

    const file = storage.file(`images/${jobId}.png`);
    await file.save(buffer, { contentType: "image/png" });

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: "03-01-2030",
    });

    await ref.update({
      status: "done",
      imageUrl: url,
      completedAt: Date.now(),
    });
  } catch (e) {
    console.error("PROCESS JOB ERROR:", e);
    await ref.update({ status: "error", error: e.message });
  }
};
