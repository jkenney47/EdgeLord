#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4317";
const replaceBars = process.argv.includes("--replace-bars");
const forceReplaceBars = process.argv.includes("--force-replace-bars");
const researchReady = process.argv.includes("--research-ready");
const optionNamesWithValues = new Set(["--target-start", "--min-years", "--min-paired-overlap-pct"]);
let skipNext = false;
const csvArg = process.argv.slice(2).find((arg) => {
  if (skipNext) {
    skipNext = false;
    return false;
  }
  if (optionNamesWithValues.has(arg)) {
    skipNext = true;
    return false;
  }
  return !arg.startsWith("--");
});

if (!csvArg || csvArg === "--help" || csvArg === "-h") {
  console.log("Usage: pnpm import:csv /path/to/adjusted-bars.csv [--replace-bars] [--force-replace-bars] [--research-ready] [--target-start YYYY-MM-DD] [--min-years N] [--min-paired-overlap-pct N]");
  console.log("");
  console.log("CSV columns: ticker,timestamp,open,high,low,close,volume");
  console.log("Optional column: adjusted. If present, every row must be truthy: 1, true, yes, y, or adjusted.");
  console.log("--replace-bars deletes existing cached bars before importing.");
  console.log("--force-replace-bars allows replacement when active labels exist. Run pnpm export:backup and pnpm labels:integrity first.");
  console.log("--research-ready requires SOXL/SOXS coverage and paired timestamp overlap suitable for strategy research before importing.");
  process.exit(process.argv.some((arg) => arg === "--help" || arg === "-h") ? 0 : 1);
}

const csvPath = path.resolve(root, csvArg);
if (!fs.existsSync(csvPath)) {
  throw new Error(`CSV file not found: ${csvPath}`);
}

const validationArgs = ["scripts/validate-csv.mjs", csvPath];
if (researchReady) validationArgs.push("--research-ready");
for (const optionName of optionNamesWithValues) {
  const index = process.argv.indexOf(optionName);
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--")) {
    validationArgs.push(optionName, process.argv[index + 1]);
  }
  const equalsArg = process.argv.find((arg) => arg.startsWith(`${optionName}=`));
  if (equalsArg) {
    validationArgs.push(equalsArg);
  }
}

execFileSync("node", validationArgs, {
  cwd: root,
  stdio: "inherit"
});

const response = await fetch(`${baseUrl}/import/csv`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    path: path.relative(root, csvPath),
    replaceBars,
    forceReplaceBars
  })
});

if (!response.ok) {
  const body = await response.text();
  if (response.status === 409 && replaceBars && !forceReplaceBars) {
    throw new Error(`${body}\n\nUse pnpm export:backup, then retry with --replace-bars --force-replace-bars only if you intend to revalidate existing labels against the new bar cache.`);
  }
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
