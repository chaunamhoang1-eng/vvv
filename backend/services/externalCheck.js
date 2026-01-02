import axios from "axios";
import fs from "fs";
import path from "path";
import FormData from "form-data";

/* ================= CONFIG ================= */
const BASE_URL = "http://154.64.255.101:18000";
const UPLOAD_URL = `${BASE_URL}/api/upload`;
const ACTIVATION_CODE = process.env.ACTIVATION_CODE;

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET = process.env.PINATA_SECRET_API_KEY;

const TMP_DIR = "./tmp";
fs.mkdirSync(TMP_DIR, { recursive: true });

/* ================= FILE COUNTER ================= */
/**
 * ⚠️ Resets on server restart (OK for now)
 * For production → store in DB
 */
let fileCounter = 1;

/* ================= DOWNLOAD INPUT FILE ================= */
async function downloadFromUrl(fileUrl) {
  const index = fileCounter++;

  const res = await axios.get(fileUrl, {
    responseType: "stream",
    timeout: 60000
  });

  const filePath = path.join(TMP_DIR, `${index}.pdf`);

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    res.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  return {
    filePath,
    title: String(index),
    index
  };
}

/* ================= UPLOAD TO CHECK SERVICE ================= */
async function uploadToService(filePath, title) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));
  form.append("activation_code", ACTIVATION_CODE);
  form.append("title", title);
  form.append("check_type", 3);
  form.append(
    "filters",
    JSON.stringify({
      language: "en-US",
      exclude_bibliography: true
    })
  );

  const res = await axios.post(UPLOAD_URL, form, {
    headers: form.getHeaders(),
    timeout: 60000
  });

  if (!res.data?.success) {
    throw new Error(res.data?.message || "Upload failed");
  }

  return res.data.data.task_id;
}

/* ================= WAIT FOR RESULT (SAFE) ================= */
async function waitForCompletion(taskId, maxWaitMs = 5 * 60 * 1000) {
  const url = `${BASE_URL}/api/tasks/${taskId}/status`;
  const start = Date.now();

  let lastData = null;

  while (true) {
    const res = await axios.get(url);
    const d = res.data?.data;
    lastData = d;

    if (!d) {
      throw new Error("Invalid status response");
    }

    const progress = d.progress ?? 0;
    const hasAI = d.has_ai_pdf === true;
    const hasSim = d.has_similarity_pdf === true;

    if (hasAI || hasSim || progress === 100) {
      return d;
    }

    if (Date.now() - start > maxWaitMs) {
      console.warn("⚠️ Timeout reached, returning last known state");
      return lastData;
    }

    await new Promise(r => setTimeout(r, 5000));
  }
}

/* ================= DOWNLOAD REPORT ================= */
async function downloadReport(taskId, type, index) {
  const url = `${BASE_URL}/api/tasks/${taskId}/download/${type}`;
  const filePath = path.join(TMP_DIR, `${index}_${type}.pdf`);

  const res = await axios.get(url, {
    responseType: "stream",
    timeout: 60000
  });

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    res.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  return filePath;
}

/* ================= UPLOAD TO PINATA ================= */
async function uploadToPinata(filePath, name) {
  const data = new FormData();
  data.append("file", fs.createReadStream(filePath));
  data.append("pinataMetadata", JSON.stringify({ name }));

  const res = await axios.post(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    data,
    {
      headers: {
        ...data.getHeaders(),
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET
      },
      maxBodyLength: Infinity
    }
  );

  return `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`;
}

/* ================= MAIN FUNCTION ================= */
export async function runPlagCheck(fileUrl) {
  const { filePath, title, index } = await downloadFromUrl(fileUrl);

  const taskId = await uploadToService(filePath, title);
  const result = await waitForCompletion(taskId);

  const outputs = {};

  if (result?.has_ai_pdf) {
    const aiPath = await downloadReport(taskId, "ai", index);
    outputs.ai_url = await uploadToPinata(aiPath, `${index}_ai`);
  }

  if (result?.has_similarity_pdf) {
    const simPath = await downloadReport(taskId, "similarity", index);
    outputs.similarity_url = await uploadToPinata(simPath, `${index}_similarity`);
  }

  return {
    taskId,
    ai_score: result?.ai_score ?? 0,
    similarity_score: result?.similarity_score ?? 0,
    outputs
  };
}
