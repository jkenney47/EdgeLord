#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4317";
const reportsDir = path.join(root, "reports");
const tickers = ["SOXL", "SOXS"];
const timeframes = ["1D", "4H", "2H"];

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[-:.]/g, "");
}

function daysBetween(first, last) {
  if (!first || !last) return 0;
  return Math.max(0, (new Date(last).getTime() - new Date(first).getTime()) / 86_400_000);
}

function yearsFromDays(days) {
  return days / 365.25;
}

function summarizeSources(bars) {
  const sourceCounts = new Map();
  for (const bar of bars) {
    const source = bar.source || "unknown";
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }

  return [...sourceCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([source, count]) => `${source}:${count}`)
    .join(", ");
}

async function getBars(ticker, timeframe) {
  const params = new URLSearchParams({ ticker, timeframe });
  const response = await fetch(`${baseUrl}/bars?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`/bars ${ticker} ${timeframe} returned ${response.status}. Start the API with pnpm dev or set API_BASE_URL.`);
  }
  const body = await response.json();
  return body.bars ?? [];
}

async function getBarsSummary() {
  const response = await fetch(`${baseUrl}/bars/summary`);
  if (!response.ok) {
    throw new Error(`/bars/summary returned ${response.status}. Start the API with pnpm dev or set API_BASE_URL.`);
  }
  const body = await response.json();
  return body.rows ?? [];
}

function sourceSet(rows, timeframe) {
  return new Set(
    rows
      .filter((row) => row.timeframe === timeframe)
      .map((row) => row.source)
      .filter(Boolean)
  );
}

const summaryRows = await getBarsSummary();
const rows = [];
for (const ticker of tickers) {
  for (const timeframe of timeframes) {
    const bars = await getBars(ticker, timeframe);
    const first = bars.at(0)?.timestamp ?? "";
    const last = bars.at(-1)?.timestamp ?? "";
    rows.push({
      ticker,
      timeframe,
      bars: bars.length,
      first,
      last,
      spanDays: daysBetween(first, last),
      sources: summarizeSources(bars)
    });
  }
}

const lines = [
  "EdgeLord Data Coverage",
  "======================",
  `api: ${baseUrl}`,
  "",
  "| Ticker | Timeframe | Bars | First | Last | Span Days | Sources |",
  "| --- | --- | ---: | --- | --- | ---: | --- |"
];

for (const row of rows) {
  lines.push(`| ${row.ticker} | ${row.timeframe} | ${row.bars} | ${row.first || "-"} | ${row.last || "-"} | ${row.spanDays.toFixed(1)} | ${row.sources || "-"} |`);
}

lines.push("");
lines.push("Raw Imports");
lines.push("| Ticker | Source | Bars | First | Last |");
lines.push("| --- | --- | ---: | --- | --- |");
for (const row of summaryRows.filter((item) => item.timeframe === "RAW")) {
  lines.push(`| ${row.ticker} | ${row.source} | ${row.bars} | ${row.first || "-"} | ${row.last || "-"} |`);
}
if (!summaryRows.some((item) => item.timeframe === "RAW")) {
  lines.push("| - | - | 0 | - | - |");
}

const allRowsHaveData = rows.every((row) => row.bars > 0);
const shortestSpan = Math.min(...rows.map((row) => row.spanDays));
const earliestChartTimestamp = rows
  .map((row) => row.first)
  .filter(Boolean)
  .sort()[0] ?? "";
const targetStart = "2011-01-01T00:00:00.000Z";
const alpacaKnownStart = "2016-01-04T14:30:00.000Z";
const targetGapDays = earliestChartTimestamp > targetStart ? daysBetween(targetStart, earliestChartTimestamp) : 0;
const unresolvedTargetGap = targetGapDays > 0 ? {
  targetStart,
  earliestChartTimestamp,
  missingStart: targetStart,
  missingEnd: earliestChartTimestamp,
  gapDays: targetGapDays,
  gapYears: yearsFromDays(targetGapDays),
  status: "unresolved_external_data_source"
} : null;
const rawSources = sourceSet(summaryRows, "RAW");
const chartSources = sourceSet(summaryRows, "1D");
const onlySampleData = rawSources.size === 1 && rawSources.has("sample");
const hasSampleData = rawSources.has("sample");
const hasCsvData = rawSources.has("csv");
let readinessCode = "ready";
const readinessMessages = [];
lines.push("");
lines.push("Readiness");
if (!allRowsHaveData) {
  readinessCode = "missing_bars";
  readinessMessages.push("Missing bars for at least one ticker/timeframe.");
} else if (onlySampleData) {
  readinessCode = "sample_only";
  readinessMessages.push("Only bundled sample data is loaded. Import adjusted SOXL/SOXS CSV before serious labeling.");
  readinessMessages.push("Recommended: `pnpm validate:csv /path/to/adjusted-bars.csv --research-ready`, then `pnpm import:csv /path/to/adjusted-bars.csv --replace-bars --research-ready`.");
} else if (hasSampleData && hasCsvData) {
  readinessCode = "mixed_sample_csv";
  readinessMessages.push("Sample and CSV data are mixed. Prefer re-importing with --replace-bars before serious labeling.");
  readinessMessages.push("Recommended: `pnpm import:csv /path/to/adjusted-bars.csv --replace-bars --research-ready`.");
} else if (chartSources.size === 1 && chartSources.has("aggregate") && rawSources.size === 0) {
  readinessCode = "aggregate_only";
  readinessMessages.push("Chart bars exist without RAW import rows. Re-import adjusted CSV with --replace-bars before serious labeling.");
  readinessMessages.push("Recommended: `pnpm import:csv /path/to/adjusted-bars.csv --replace-bars --research-ready`.");
} else if (shortestSpan < 365) {
  readinessCode = "too_short";
  readinessMessages.push(`Data is still too short for serious strategy work. Shortest span is ${shortestSpan.toFixed(1)} days.`);
  readinessMessages.push("Recommended: import a longer adjusted backfill with `--replace-bars --research-ready`.");
} else if (shortestSpan < 365 * 5) {
  readinessCode = "below_target";
  readinessMessages.push(`Data is usable for early tests, but below the 2011-present target. Shortest span is ${shortestSpan.toFixed(1)} days.`);
  readinessMessages.push("Recommended: keep this for smoke testing only; use `--research-ready` for the real backfill.");
} else if (earliestChartTimestamp > targetStart) {
  readinessCode = "alpaca_era_ready";
  readinessMessages.push(`Data span is ready for Alpaca-era research, starting ${earliestChartTimestamp.slice(0, 10)}.`);
  readinessMessages.push(`The ${targetStart.slice(0, 10)} -> ${earliestChartTimestamp.slice(0, 10)} SOXL/SOXS history gap remains unresolved (${yearsFromDays(targetGapDays).toFixed(1)} years); current Alpaca SIP minute coverage starts around ${alpacaKnownStart.slice(0, 10)}.`);
} else {
  readinessMessages.push(`Data span is ready for broader research. Shortest span is ${shortestSpan.toFixed(1)} days.`);
}
for (const message of readinessMessages) {
  lines.push(`- ${message}`);
}

const report = `${lines.join("\n")}\n`;
process.stdout.write(report);

if (process.argv.includes("--write")) {
  fs.mkdirSync(reportsDir, { recursive: true });
  const slug = timestampSlug();
  const reportPath = path.join(reportsDir, `${slug}-data-coverage.md`);
  const jsonPath = path.join(reportsDir, `${slug}-data-coverage.json`);
  fs.writeFileSync(reportPath, report);
  fs.writeFileSync(jsonPath, `${JSON.stringify({
    version: "edgelord.data_coverage.v1",
    createdAt: new Date().toISOString(),
    apiBaseUrl: baseUrl,
    readiness: {
      code: readinessCode,
      readyForResearch: readinessCode === "ready" || readinessCode === "alpaca_era_ready",
      targetStart,
      earliestChartTimestamp,
      unresolvedTargetGap,
      shortestSpanDays: shortestSpan,
      messages: readinessMessages
    },
    chartRows: rows,
    rawImports: summaryRows.filter((item) => item.timeframe === "RAW")
  }, null, 2)}\n`);
  console.log(`report: ${path.relative(root, reportPath)}`);
  console.log(`json: ${path.relative(root, jsonPath)}`);
}
