import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const exportFiles = [
  ["labels.csv", "/export/labels.csv"],
  ["trades.csv", "/export/trades.csv"],
  ["training-features.csv", "/export/training-features.csv"],
  ["trade-candidates.csv", "/export/trade-candidates.csv"],
  ["labels.jsonl", "/export/labels.jsonl"],
  ["manifest.api.json", "/export/manifest.json"],
  ["schema.json", "/export/schema.json"]
];

async function downloadExport(baseUrl, route, target) {
  const response = await fetch(`${baseUrl}${route}`);
  if (!response.ok) {
    throw new Error(`${route} returned ${response.status}. Start the API with pnpm dev or set API_BASE_URL.`);
  }
  const body = await response.text();
  fs.writeFileSync(target, body);
  return {
    bytes: Buffer.byteLength(body, "utf8"),
    sha256: crypto.createHash("sha256").update(body, "utf8").digest("hex")
  };
}

export async function downloadExportFiles({ baseUrl, backupDir, root, logWrites = false }) {
  const files = [];
  for (const [name, route] of exportFiles) {
    const target = path.join(backupDir, name);
    const { bytes, sha256 } = await downloadExport(baseUrl, route, target);
    files.push({ name, route, bytes, sha256 });
    if (logWrites) console.log(`wrote ${path.relative(root, target)} (${bytes} bytes)`);
  }
  return files;
}

export function readApiManifest(backupDir) {
  return JSON.parse(fs.readFileSync(path.join(backupDir, "manifest.api.json"), "utf8"));
}
