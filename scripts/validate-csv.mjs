#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const rawArgs = process.argv.slice(2);
const requiredColumns = ["ticker", "timestamp", "open", "high", "low", "close", "volume"];
const expectedTickers = ["SOXL", "SOXS"];
const researchReady = rawArgs.includes("--research-ready");

function optionValue(name, fallback) {
  const equalsArg = rawArgs.find((arg) => arg.startsWith(`${name}=`));
  if (equalsArg) return equalsArg.slice(name.length + 1);
  const index = rawArgs.indexOf(name);
  if (index >= 0 && rawArgs[index + 1] && !rawArgs[index + 1].startsWith("--")) {
    return rawArgs[index + 1];
  }
  return fallback;
}

const targetStart = optionValue("--target-start", "2011-01-01");
const jsonOutput = optionValue("--json-output", "");
const minYears = Number(optionValue("--min-years", "10"));
if (!Number.isFinite(minYears) || minYears < 0) {
  throw new Error("--min-years must be a non-negative number");
}
const optionNamesWithValues = new Set(["--target-start", "--min-years", "--json-output"]);
let skipNext = false;
const csvArg = rawArgs.find((arg) => {
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
  console.log("Usage: pnpm validate:csv /path/to/adjusted-bars.csv [--research-ready] [--target-start YYYY-MM-DD] [--min-years N] [--json-output reports/import-check.json]");
  console.log("");
  console.log(`Required columns: ${requiredColumns.join(",")}`);
  console.log("");
  console.log("--research-ready fails the check when duplicate rows exist or SOXL/SOXS coverage is below the configured target.");
  process.exit(rawArgs.some((arg) => arg === "--help" || arg === "-h") ? 0 : 1);
}

const csvPath = path.resolve(root, csvArg);
if (!fs.existsSync(csvPath)) {
  throw new Error(`CSV file not found: ${csvPath}`);
}

function parseLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === "\"") quoted = !quoted;
    else if (char === "," && !quoted) {
      values.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim().replace(/^"|"$/g, ""));
  return values;
}

const lines = fs.readFileSync(csvPath, "utf8").split(/\r?\n/).filter((line) => line.trim());
if (lines.length < 2) {
  throw new Error("CSV must include a header and at least one data row");
}

const headers = parseLine(lines[0]).map((header) => header.toLowerCase());
const missingColumns = requiredColumns.filter((column) => !headers.includes(column));
if (missingColumns.length > 0) {
  throw new Error(`CSV missing required columns: ${missingColumns.join(", ")}`);
}

const stats = new Map(expectedTickers.map((ticker) => [ticker, {
  count: 0,
  first: "",
  last: "",
  timestamps: new Set()
}]));
const errors = [];
let validRows = 0;
let duplicateRows = 0;

for (const [lineIndex, line] of lines.slice(1).entries()) {
  const rowNumber = lineIndex + 2;
  const values = parseLine(line);
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  const ticker = row.ticker;
  const timestamp = new Date(row.timestamp);
  const open = Number(row.open);
  const high = Number(row.high);
  const low = Number(row.low);
  const close = Number(row.close);
  const volume = Number(row.volume);

  if (!expectedTickers.includes(ticker)) {
    errors.push(`row ${rowNumber}: unsupported ticker ${ticker || "(blank)"}`);
    continue;
  }
  if (Number.isNaN(timestamp.getTime())) {
    errors.push(`row ${rowNumber}: invalid timestamp ${row.timestamp || "(blank)"}`);
    continue;
  }
  if (![open, high, low, close, volume].every(Number.isFinite)) {
    errors.push(`row ${rowNumber}: invalid OHLCV number`);
    continue;
  }
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) {
    errors.push(`row ${rowNumber}: OHLCV values must be positive, with non-negative volume`);
    continue;
  }
  if (high < Math.max(open, close) || low > Math.min(open, close) || high < low) {
    errors.push(`row ${rowNumber}: OHLC values are internally inconsistent`);
    continue;
  }

  const iso = timestamp.toISOString();
  const key = `${ticker}:${iso}`;
  const tickerStats = stats.get(ticker);
  if (tickerStats.timestamps.has(key)) {
    duplicateRows += 1;
    errors.push(`row ${rowNumber}: duplicate ${ticker} timestamp ${iso}`);
  }
  tickerStats.timestamps.add(key);
  tickerStats.count += 1;
  tickerStats.first = tickerStats.first ? (iso < tickerStats.first ? iso : tickerStats.first) : iso;
  tickerStats.last = tickerStats.last ? (iso > tickerStats.last ? iso : tickerStats.last) : iso;
  validRows += 1;
}

console.log(`CSV validation: ${path.relative(root, csvPath)}`);
console.log(`rows: ${lines.length - 1}`);
console.log(`valid_rows: ${validRows}`);
console.log(`duplicate_ticker_timestamps: ${duplicateRows}`);
for (const ticker of expectedTickers) {
  const tickerStats = stats.get(ticker);
  console.log(`${ticker}: ${tickerStats.count} rows ${tickerStats.first || "-"} -> ${tickerStats.last || "-"}`);
}

if (errors.length > 0) {
  console.error("\nErrors");
  for (const error of errors.slice(0, 25)) {
    console.error(`- ${error}`);
  }
  if (errors.length > 25) {
    console.error(`- ... ${errors.length - 25} more`);
  }
  process.exit(1);
}

const missingTickers = expectedTickers.filter((ticker) => stats.get(ticker).count === 0);
if (missingTickers.length > 0) {
  throw new Error(`CSV contains no rows for: ${missingTickers.join(", ")}`);
}

function spanYears(first, last) {
  if (!first || !last) return 0;
  return Math.max(0, (new Date(last).getTime() - new Date(first).getTime()) / (365.25 * 86_400_000));
}

const targetStartDate = new Date(`${targetStart}T00:00:00.000Z`);
if (Number.isNaN(targetStartDate.getTime())) {
  throw new Error(`Invalid --target-start date: ${targetStart}`);
}

const readinessWarnings = [];
for (const ticker of expectedTickers) {
  const tickerStats = stats.get(ticker);
  const firstDate = new Date(tickerStats.first);
  const firstDay = Number.isNaN(firstDate.getTime()) ? "" : firstDate.toISOString().slice(0, 10);
  const tickerSpanYears = spanYears(tickerStats.first, tickerStats.last);
  if (firstDay > targetStart) {
    readinessWarnings.push(`${ticker} starts at ${tickerStats.first}, after target start ${targetStart}`);
  }
  if (tickerSpanYears < minYears) {
    readinessWarnings.push(`${ticker} spans ${tickerSpanYears.toFixed(1)} years, below --min-years ${minYears}`);
  }
}
if (readinessWarnings.length > 0) {
  console.log("");
  console.log("Research readiness warnings");
  for (const warning of readinessWarnings) {
    console.log(`- ${warning}`);
  }
}

const summary = {
  version: "edgelord.csv_validation.v1",
  createdAt: new Date().toISOString(),
  csvPath: path.relative(root, csvPath),
  rows: lines.length - 1,
  validRows,
  duplicateTickerTimestamps: duplicateRows,
  targetStart,
  minYears,
  researchReadyRequested: researchReady,
  tickers: Object.fromEntries(expectedTickers.map((ticker) => {
    const tickerStats = stats.get(ticker);
    return [ticker, {
      rows: tickerStats.count,
      first: tickerStats.first || null,
      last: tickerStats.last || null,
      spanYears: spanYears(tickerStats.first, tickerStats.last)
    }];
  })),
  errors,
  warnings: readinessWarnings,
  importable: errors.length === 0 && missingTickers.length === 0,
  researchReady: errors.length === 0 && missingTickers.length === 0 && readinessWarnings.length === 0
};

if (jsonOutput) {
  const target = path.resolve(root, jsonOutput);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`json: ${path.relative(root, target)}`);
}

if (researchReady && readinessWarnings.length > 0) {
  throw new Error("CSV is importable, but not research-ready. Fix warnings above or rerun without --research-ready.");
}

console.log("ok adjusted CSV shape is importable");
if (researchReady) {
  console.log("ok adjusted CSV coverage is research-ready");
}
