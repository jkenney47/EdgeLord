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
const trainingEligibilityMismatches = [];
const eligibleOrphanExits = [];

function expectedTrainingEligible(label) {
  if (Number(label.potential_visual_leakage) === 1) return false;
  return label.label_source === "actual_trade" || (label.label_source === "retrospective_replay" && label.capture_mode === "replay");
}

for (const label of labels) {
  const expectedEligible = expectedTrainingEligible(label);
  if (Number(label.training_eligible) !== (expectedEligible ? 1 : 0)) {
    trainingEligibilityMismatches.push({ label, expectedEligible });
  }
  if (
    label.action === "EXIT" &&
    Number(label.training_eligible) === 1 &&
    (!label.trade_id || !label.parent_entry_label_id)
  ) {
    eligibleOrphanExits.push(label);
  }

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
  `training_eligibility_mismatches: ${trainingEligibilityMismatches.length}`,
  `eligible_orphan_exits: ${eligibleOrphanExits.length}`,
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

lines.push("", "Training Eligibility Mismatches");
if (trainingEligibilityMismatches.length === 0) {
  lines.push("- none");
} else {
  for (const item of trainingEligibilityMismatches.slice(0, 25)) {
    lines.push(
      `- ${item.label.id} ${item.label.action} ${item.label.label_source} ${item.label.capture_mode} ` +
      `leakage=${item.label.potential_visual_leakage}: label=${item.label.training_eligible} expected=${item.expectedEligible ? 1 : 0}`
    );
  }
}

lines.push("", "Eligible Orphan Exits");
if (eligibleOrphanExits.length === 0) {
  lines.push("- none");
} else {
  for (const label of eligibleOrphanExits.slice(0, 25)) {
    lines.push(`- ${label.id} ${label.ticker} ${label.timeframe} ${label.timestamp}`);
  }
}

lines.push("", "Readiness");
if (
  missingBars.length ||
  priceMismatches.length ||
  staleIndexes.length ||
  trainingEligibilityMismatches.length ||
  eligibleOrphanExits.length
) {
  lines.push("- Label integrity issues exist. Repair or re-label before modeling.");
} else {
  lines.push("- Labels match the current bar cache and training eligibility policy.");
}

const report = `${lines.join("\n")}\n`;
process.stdout.write(report);

if (writeReport) {
  fs.mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, `${timestampSlug()}-label-integrity.md`);
  fs.writeFileSync(reportPath, report);
  console.log(`report: ${path.relative(root, reportPath)}`);
}
