const express = require("express");
const cors = require("cors");

const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");

const { createJob } = require("./create-job");
const { processJob } = require("./process-job");

// ✅ Región global (v2)
setGlobalOptions({ region: "us-central1" });

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Ruta HTTP para crear job
app.post("/create-job", createJob);

// ✅ HTTP Function (v2) + secrets
exports.images = onRequest(
  {
    secrets: ["OPENAI_API_KEY"],
    invoker: "private",   // ✅ evita IAM public
  },
  app
);

// ✅ Firestore Trigger (v2) + secrets
exports.processImageJob = onDocumentCreated(
  { document: "imageJobs/{jobId}", secrets: ["OPENAI_API_KEY"] },
  async (event) => {
    const jobId = event.params.jobId;
    await processJob(jobId);
  }
);
