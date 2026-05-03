#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { downloadExportFiles, readApiManifest } from "./export-downloads.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4317";
const exportsDir = path.join(root, "exports");

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[-:.]/g, "");
}

fs.mkdirSync(exportsDir, { recursive: true });

const backupDir = path.join(exportsDir, timestampSlug());
fs.mkdirSync(backupDir);

const files = await downloadExportFiles({ baseUrl, backupDir, root, logWrites: true });
const apiManifest = readApiManifest(backupDir);
const manifest = {
  version: "edgelord.export_backup.v1",
  createdAt: new Date().toISOString(),
  apiBaseUrl: baseUrl,
  files,
  apiManifest
};
fs.writeFileSync(path.join(backupDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${path.relative(root, path.join(backupDir, "manifest.json"))}`);
console.log(`api_manifest: ${apiManifest.version ?? "unknown"} (${apiManifest.labels?.trainingEligible ?? 0} training labels)`);
console.log(`backup: ${path.relative(root, backupDir)}`);
