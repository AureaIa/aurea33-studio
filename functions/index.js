const express = require("express");
const cors = require("cors");

const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");

const createJob = require("./create-job");
const getJob = require("./get-job");
const { processJob } = require("./process-job");

setGlobalOptions({ region: "us-central1" });

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.post("/create-job", createJob);
app.get("/get-job", getJob);

exports.images = onRequest(
  {
    secrets: ["OPENAI_API_KEY"],
    invoker: "private",
  },
  app
);

exports.processImageJob = onDocumentCreated(
  { document: "imageJobs/{jobId}", secrets: ["OPENAI_API_KEY"] },
  async (event) => {
    const jobId = event.params.jobId;
    await processJob(jobId);
  }
);
