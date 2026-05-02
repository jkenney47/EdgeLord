#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4317";
const reportsDir = path.join(root, "reports");
const writeReport = process.argv.includes("--write");
const priceTolerance = 0.0001;

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function fetchJson(route) {
  const response = await fetch(`${baseUrl}${route}`);
  if (!response.ok) {
    throw new Error(`${route} returned ${response.status}. Start the API with pnpm dev or set API_BASE_URL.`);
  }
  return response.json();
}

const labels = (await fetchJson("/labels")).labels ?? [];
const barsByKey = new Map();

async function barsFor(ticker, timeframe) {
  const key = `${ticker}:${timeframe}`;
  if (!barsByKey.has(key)) {
    const params = new URLSearchParams({ ticker, timeframe });
    const bars = (await fetchJson(`/bars?${params.toString()}`)).bars ?? [];
    barsByKey.set(key, new Map(bars.map((bar) => [bar.timestamp, bar])));
  }
  return barsByKey.get(key);
}

const missingBars = [];
const priceMismatches = [];
const staleIndexes = [];

for (const label of labels) {
  const bars = await barsFor(label.ticker, label.timeframe);
  const bar = bars.get(label.timestamp);
  if (!bar) {
    missingBars.push(label);
    continue;
  }

  const priceDelta = Math.abs(Number(label.chart_price) - Number(bar.close));
  if (priceDelta > priceTolerance) {
    priceMismatches.push({ label, bar, priceDelta });
  }

  const timestamps = Array.from(bars.keys());
  const expectedIndex = timestamps.indexOf(label.timestamp);
  if (expectedIndex >= 0 && Number(label.bar_index) !== expectedIndex) {
    staleIndexes.push({ label, expectedIndex });
  }
}

const lines = [
  "EdgeLord Label Integrity",
  "========================",
  `api: ${baseUrl}`,
  `labels: ${labels.length}`,
  `missing_bar_labels: ${missingBars.length}`,
  `chart_price_mismatches: ${priceMismatches.length}`,
  `stale_bar_indexes: ${staleIndexes.length}`,
  "",
  "Missing Bars"
];

if (missingBars.length === 0) {
  lines.push("- none");
} else {
  for (const label of missingBars.slice(0, 25)) {
    lines.push(`- ${label.id} ${label.action} ${label.ticker} ${label.timeframe} ${label.timestamp}`);
  }
}

lines.push("", "Chart Price Mismatches");
if (priceMismatches.length === 0) {
  lines.push("- none");
} else {
  for (const item of priceMismatches.slice(0, 25)) {
    lines.push(`- ${item.label.id} ${item.label.ticker} ${item.label.timeframe} ${item.label.timestamp}: label=${item.label.chart_price} bar_close=${item.bar.close}`);
  }
}

lines.push("", "Stale Bar Indexes");
if (staleIndexes.length === 0) {
  lines.push("- none");
} else {
  for (const item of staleIndexes.slice(0, 25)) {
    lines.push(`- ${item.label.id} ${item.label.ticker} ${item.label.timeframe} ${item.label.timestamp}: label=${item.label.bar_index} expected=${item.expectedIndex}`);
  }
}

lines.push("", "Readiness");
if (missingBars.length || priceMismatches.length || staleIndexes.length) {
  lines.push("- Label integrity issues exist. Repair or re-label before modeling.");
} else {
  lines.push("- Labels match the current bar cache.");
}

const report = `${lines.join("\n")}\n`;
process.stdout.write(report);

if (writeReport) {
  fs.mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, `${timestampSlug()}-label-integrity.md`);
  fs.writeFileSync(reportPath, report);
  console.log(`report: ${path.relative(root, reportPath)}`);
}
