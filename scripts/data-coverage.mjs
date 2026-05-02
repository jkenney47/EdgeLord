#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4317";
const reportsDir = path.join(root, "reports");
const tickers = ["SOXL", "SOXS"];
const timeframes = ["1D", "4H", "2H"];

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function daysBetween(first, last) {
  if (!first || !last) return 0;
  return Math.max(0, (new Date(last).getTime() - new Date(first).getTime()) / 86_400_000);
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
const rawSources = sourceSet(summaryRows, "RAW");
const chartSources = sourceSet(summaryRows, "1D");
const onlySampleData = rawSources.size === 1 && rawSources.has("sample");
const hasSampleData = rawSources.has("sample");
const hasCsvData = rawSources.has("csv");
lines.push("");
lines.push("Readiness");
if (!allRowsHaveData) {
  lines.push("- Missing bars for at least one ticker/timeframe.");
} else if (onlySampleData) {
  lines.push("- Only bundled sample data is loaded. Import adjusted SOXL/SOXS CSV before serious labeling.");
  lines.push("- Recommended: `pnpm validate:csv /path/to/adjusted-bars.csv --research-ready`, then `pnpm import:csv /path/to/adjusted-bars.csv --replace-bars --research-ready`.");
} else if (hasSampleData && hasCsvData) {
  lines.push("- Sample and CSV data are mixed. Prefer re-importing with --replace-bars before serious labeling.");
  lines.push("- Recommended: `pnpm import:csv /path/to/adjusted-bars.csv --replace-bars --research-ready`.");
} else if (chartSources.size === 1 && chartSources.has("aggregate") && rawSources.size === 0) {
  lines.push("- Chart bars exist without RAW import rows. Re-import adjusted CSV with --replace-bars before serious labeling.");
  lines.push("- Recommended: `pnpm import:csv /path/to/adjusted-bars.csv --replace-bars --research-ready`.");
} else if (shortestSpan < 365) {
  lines.push(`- Data is still too short for serious strategy work. Shortest span is ${shortestSpan.toFixed(1)} days.`);
  lines.push("- Recommended: import a longer adjusted backfill with `--replace-bars --research-ready`.");
} else if (shortestSpan < 365 * 5) {
  lines.push(`- Data is usable for early tests, but below the 2011-present target. Shortest span is ${shortestSpan.toFixed(1)} days.`);
  lines.push("- Recommended: keep this for smoke testing only; use `--research-ready` for the real backfill.");
} else {
  lines.push(`- Data span is ready for broader research. Shortest span is ${shortestSpan.toFixed(1)} days.`);
}

const report = `${lines.join("\n")}\n`;
process.stdout.write(report);

if (process.argv.includes("--write")) {
  fs.mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, `${timestampSlug()}-data-coverage.md`);
  fs.writeFileSync(reportPath, report);
  console.log(`report: ${path.relative(root, reportPath)}`);
}
