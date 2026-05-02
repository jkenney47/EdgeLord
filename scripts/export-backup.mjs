#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4317";
const exportsDir = path.join(root, "exports");

const exportFiles = [
  ["labels.csv", "/export/labels.csv"],
  ["trades.csv", "/export/trades.csv"],
  ["training-features.csv", "/export/training-features.csv"],
  ["trade-candidates.csv", "/export/trade-candidates.csv"],
  ["labels.jsonl", "/export/labels.jsonl"],
  ["manifest.api.json", "/export/manifest.json"]
];

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[-:.]/g, "");
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

const backupDir = path.join(exportsDir, timestampSlug());
fs.mkdirSync(backupDir);

const files = [];
for (const [name, route] of exportFiles) {
  const target = path.join(backupDir, name);
  const bytes = await download(route, target);
  files.push({ name, route, bytes });
  console.log(`wrote ${path.relative(root, target)} (${bytes} bytes)`);
}

const manifest = {
  createdAt: new Date().toISOString(),
  apiBaseUrl: baseUrl,
  files
};
fs.writeFileSync(path.join(backupDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${path.relative(root, path.join(backupDir, "manifest.json"))}`);
console.log(`backup: ${path.relative(root, backupDir)}`);
