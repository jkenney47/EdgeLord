#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4317";
const replaceBars = process.argv.includes("--replace-bars");
const csvArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));

if (!csvArg || csvArg === "--help" || csvArg === "-h") {
  console.log("Usage: pnpm import:csv /path/to/adjusted-bars.csv [--replace-bars]");
  console.log("");
  console.log("CSV columns: ticker,timestamp,open,high,low,close,volume");
  console.log("--replace-bars deletes existing cached bars before importing. Labels/trades are not deleted.");
  process.exit(csvArg ? 0 : 1);
}

const csvPath = path.resolve(root, csvArg);
if (!fs.existsSync(csvPath)) {
  throw new Error(`CSV file not found: ${csvPath}`);
}

execFileSync("node", ["scripts/validate-csv.mjs", csvPath], {
  cwd: root,
  stdio: "inherit"
});

const csv = fs.readFileSync(csvPath, "utf8");
const response = await fetch(`${baseUrl}/import/csv`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ csv, replaceBars })
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`/import/csv returned ${response.status}: ${body}`);
}

const result = await response.json();
if (result.replacedBars) {
  console.log(`replaced ${result.replacedBars} existing bars`);
}
console.log(`imported ${result.rawInserted} raw / ${result.aggregateInserted} chart bars from ${path.relative(root, csvPath)}`);

execFileSync("node", ["scripts/data-coverage.mjs", "--write"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, API_BASE_URL: baseUrl }
});
