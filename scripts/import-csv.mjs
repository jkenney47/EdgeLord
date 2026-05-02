#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4317";
const csvArg = process.argv[2];

if (!csvArg || csvArg === "--help" || csvArg === "-h") {
  console.log("Usage: pnpm import:csv /path/to/adjusted-bars.csv");
  console.log("");
  console.log("CSV columns: ticker,timestamp,open,high,low,close,volume");
  process.exit(csvArg ? 0 : 1);
}

const csvPath = path.resolve(root, csvArg);
if (!fs.existsSync(csvPath)) {
  throw new Error(`CSV file not found: ${csvPath}`);
}

const csv = fs.readFileSync(csvPath, "utf8");
const response = await fetch(`${baseUrl}/import/csv`, {
  method: "POST",
  headers: { "content-type": "text/csv" },
  body: csv
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`/import/csv returned ${response.status}: ${body}`);
}

const result = await response.json();
console.log(`imported ${result.rawInserted} raw / ${result.aggregateInserted} chart bars from ${path.relative(root, csvPath)}`);

execFileSync("node", ["scripts/data-coverage.mjs", "--write"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, API_BASE_URL: baseUrl }
});
