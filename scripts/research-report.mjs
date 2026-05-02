#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4317";

async function download(route, target) {
  const response = await fetch(`${baseUrl}${route}`);
  if (!response.ok) {
    throw new Error(`${route} returned ${response.status}. Start the API with pnpm dev or set API_BASE_URL.`);
  }
  fs.writeFileSync(target, await response.text());
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "edgelord-research-"));

try {
  const labelsPath = path.join(tempDir, "labels.csv");
  const trainingPath = path.join(tempDir, "training-features.csv");
  const tradesPath = path.join(tempDir, "trades.csv");

  await download("/export/labels.csv", labelsPath);
  await download("/export/training-features.csv", trainingPath);
  await download("/export/trades.csv", tradesPath);

  execFileSync("python3", [
    "research/dataset_report.py",
    "--labels", labelsPath,
    "--training", trainingPath,
    "--trades", tradesPath
  ], {
    cwd: root,
    stdio: "inherit"
  });
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
