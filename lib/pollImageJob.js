// lib/pollImageJob.js

export async function pollImageJob(jobId, opts = {}) {
  const {
    intervalMs = 1200,
    timeoutMs = 120000, // 2 min
  } = opts;

  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`/api/images/get-job?jobId=${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json().catch(() => ({}));

    // Si tu proxy manda { ok:false } o error, seguimos intentando un poco
    if (!data || data.ok === false) {
      await sleep(intervalMs);
      continue;
    }

    // Puede venir status arriba o dentro de job
    const status = (data.status || data.job?.status || "").toLowerCase();
    const job = data.job || {};

    if (status === "failed" || status === "error") {
      const msg = job.error || data.error || "Image job failed";
      throw new Error(msg);
    }

    if (status === "done" || status === "completed" || status === "success") {
      const imageUrl =
        job.imageUrl ||
        job.imageURL ||
        job.url ||
        job.downloadUrl ||
        job.outputUrl ||
        job.result?.imageUrl ||
        job.result?.url ||
        job.output?.[0]?.url ||
        data.imageUrl;

      if (!imageUrl) {
        // done pero sin URL = bug backend o aún no escribe storage
        throw new Error("Job está DONE pero no viene imageUrl");
      }

      return { ok: true, status: "done", jobId, imageUrl, job };
    }

    // queued / processing
    await sleep(intervalMs);
  }

  throw new Error("Timeout waiting for image");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
