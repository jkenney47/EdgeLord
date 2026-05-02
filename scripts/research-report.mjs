#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4317";
const exportsDir = path.join(root, "exports");
const reportsDir = path.join(root, "reports");
const exportFiles = [
  ["labels.csv", "/export/labels.csv"],
  ["trades.csv", "/export/trades.csv"],
  ["training-features.csv", "/export/training-features.csv"],
  ["labels.jsonl", "/export/labels.jsonl"]
];

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function download(route, target) {
  const response = await fetch(`${baseUrl}${route}`);
  if (!response.ok) {
    throw new Error(`${route} returned ${response.status}. Start the API with pnpm dev or set API_BASE_URL.`);
  }
  const body = await response.text();
  fs.writeFileSync(target, body);
  return Buffer.byteLength(body, "utf8");
}

fs.mkdirSync(exportsDir, { recursive: true });
fs.mkdirSync(reportsDir, { recursive: true });

const slug = timestampSlug();
const backupDir = path.join(exportsDir, slug);
const reportPath = path.join(reportsDir, `${slug}-dataset-report.md`);
const rulesPath = path.join(reportsDir, `${slug}-candidate-rules.md`);
fs.mkdirSync(backupDir);

const files = [];
for (const [name, route] of exportFiles) {
  const target = path.join(backupDir, name);
  const bytes = await download(route, target);
  files.push({ name, route, bytes });
}

fs.writeFileSync(path.join(backupDir, "manifest.json"), `${JSON.stringify({
  createdAt: new Date().toISOString(),
  apiBaseUrl: baseUrl,
  files,
  report: path.relative(root, reportPath),
  candidateRules: path.relative(root, rulesPath)
}, null, 2)}\n`);

execFileSync("python3", [
  "research/dataset_report.py",
  "--labels", path.join(backupDir, "labels.csv"),
  "--training", path.join(backupDir, "training-features.csv"),
  "--trades", path.join(backupDir, "trades.csv"),
  "--output", reportPath
], {
  cwd: root,
  stdio: "inherit"
});

execFileSync("python3", [
  "research/discover_rules.py",
  "--training", path.join(backupDir, "training-features.csv"),
  "--output", rulesPath
], {
  cwd: root,
  stdio: "inherit"
});

console.log(`backup: ${path.relative(root, backupDir)}`);
console.log(`report: ${path.relative(root, reportPath)}`);
console.log(`candidate_rules: ${path.relative(root, rulesPath)}`);
