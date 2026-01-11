import { adminDb } from "../../../lib/firebaseAdmin";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { prompt, size = "1024x1024" } = req.body || {};

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt requerido" });
    }

    const ref = await adminDb.collection("imageJobs").add({
      prompt,
      size,
      status: "queued",
      userId: "dev",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(200).json({ jobId: ref.id });
  } catch (err) {
    console.error("CREATE JOB ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
