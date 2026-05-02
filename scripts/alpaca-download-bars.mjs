#!/usr/bin/env node
import fs from "node:fs";
import { once } from "node:events";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const rawArgs = process.argv.slice(2);
const optionNamesWithValues = new Set([
  "--symbols",
  "--timeframe",
  "--start",
  "--end",
  "--adjustment",
  "--feed",
  "--limit",
  "--output",
  "--max-pages"
]);

function optionValue(name, fallback) {
  const equalsArg = rawArgs.find((arg) => arg.startsWith(`${name}=`));
  if (equalsArg) return equalsArg.slice(name.length + 1);
  const index = rawArgs.indexOf(name);
  if (index >= 0 && rawArgs[index + 1] && !rawArgs[index + 1].startsWith("--")) {
    return rawArgs[index + 1];
  }
  return fallback;
}

function usage() {
  console.log("Usage: pnpm data:alpaca --start YYYY-MM-DD --end YYYY-MM-DD --output data/alpaca-soxl-soxs.csv");
  console.log("");
  console.log("Environment:");
  console.log("  ALPACA_API_KEY_ID or APCA_API_KEY_ID");
  console.log("  ALPACA_API_SECRET_KEY or APCA_API_SECRET_KEY");
  console.log("");
  console.log("Options:");
  console.log("  --symbols SOXL,SOXS       default: SOXL,SOXS");
  console.log("  --timeframe 1Min          default: 1Min");
  console.log("  --start YYYY-MM-DD        default: 2011-01-01");
  console.log("  --end YYYY-MM-DD          default: today");
  console.log("  --adjustment all          default: all");
  console.log("  --feed sip                default: sip");
  console.log("  --limit 10000             default: 10000");
  console.log("  --max-pages N             optional safety cap for testing");
  console.log("  --dry-run                 print request settings without fetching");
}

if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
  usage();
  process.exit(0);
}

let skipNext = false;
const positional = rawArgs.filter((arg) => {
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
if (positional.length > 0) {
  throw new Error(`Unexpected positional arguments: ${positional.join(", ")}`);
}

const keyId = process.env.ALPACA_API_KEY_ID ?? process.env.APCA_API_KEY_ID;
const secretKey = process.env.ALPACA_API_SECRET_KEY ?? process.env.APCA_API_SECRET_KEY;
const symbols = optionValue("--symbols", "SOXL,SOXS")
  .split(",")
  .map((symbol) => symbol.trim().toUpperCase())
  .filter(Boolean);
const timeframe = optionValue("--timeframe", "1Min");
const start = optionValue("--start", "2011-01-01");
const end = optionValue("--end", new Date().toISOString().slice(0, 10));
const adjustment = optionValue("--adjustment", "all");
const feed = optionValue("--feed", "sip");
const limit = Number(optionValue("--limit", "10000"));
const maxPagesRaw = optionValue("--max-pages", "");
const maxPages = maxPagesRaw ? Number(maxPagesRaw) : null;
const output = optionValue("--output", `data/alpaca-${symbols.join("-").toLowerCase()}-${timeframe.toLowerCase()}-${start}-to-${end}.csv`);
const dryRun = rawArgs.includes("--dry-run");

if (symbols.length === 0) {
  throw new Error("--symbols must include at least one ticker");
}
if (!Number.isInteger(limit) || limit < 1 || limit > 10000) {
  throw new Error("--limit must be an integer from 1 to 10000");
}
if (maxPages !== null && (!Number.isInteger(maxPages) || maxPages < 1)) {
  throw new Error("--max-pages must be a positive integer");
}

const url = new URL("https://data.alpaca.markets/v2/stocks/bars");
url.searchParams.set("symbols", symbols.join(","));
url.searchParams.set("timeframe", timeframe);
url.searchParams.set("start", start);
url.searchParams.set("end", end);
url.searchParams.set("limit", String(limit));
url.searchParams.set("adjustment", adjustment);
url.searchParams.set("feed", feed);
url.searchParams.set("sort", "asc");

console.log("Alpaca adjusted bars download");
console.log("=============================");
console.log(`symbols: ${symbols.join(",")}`);
console.log(`timeframe: ${timeframe}`);
console.log(`start: ${start}`);
console.log(`end: ${end}`);
console.log(`adjustment: ${adjustment}`);
console.log(`feed: ${feed}`);
console.log(`output: ${path.relative(root, path.resolve(root, output))}`);

if (dryRun) {
  console.log(`url: ${url.toString()}`);
  process.exit(0);
}

if (!keyId || !secretKey) {
  throw new Error("Missing Alpaca credentials. Set ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY, or APCA_API_KEY_ID and APCA_API_SECRET_KEY.");
}

function csvValue(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function barTimestamp(bar) {
  return bar.t ?? bar.timestamp ?? "";
}

function normalizeBar(symbol, bar) {
  return [
    symbol,
    new Date(barTimestamp(bar)).toISOString(),
    bar.o ?? bar.open,
    bar.h ?? bar.high,
    bar.l ?? bar.low,
    bar.c ?? bar.close,
    bar.v ?? bar.volume
  ];
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(pageUrl, attempt = 1) {
  const response = await fetch(pageUrl, {
    headers: {
      "APCA-API-KEY-ID": keyId,
      "APCA-API-SECRET-KEY": secretKey
    }
  });

  if (response.status === 429 && attempt <= 5) {
    const retryAfter = Number(response.headers.get("retry-after") ?? "1");
    await sleep(Math.max(1, retryAfter) * 1000);
    return fetchPage(pageUrl, attempt + 1);
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Alpaca returned ${response.status}: ${body}`);
  }
  return response.json();
}

const targetPath = path.resolve(root, output);
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
const stream = fs.createWriteStream(targetPath, { encoding: "utf8" });
stream.write("ticker,timestamp,open,high,low,close,volume\n");

let pageToken = "";
let pageCount = 0;
let rowCount = 0;
const rowsBySymbol = Object.fromEntries(symbols.map((symbol) => [symbol, 0]));

try {
  while (true) {
    const pageUrl = new URL(url);
    if (pageToken) pageUrl.searchParams.set("page_token", pageToken);
    const payload = await fetchPage(pageUrl);
    pageCount += 1;

    const bars = payload.bars && typeof payload.bars === "object" ? payload.bars : {};
    for (const symbol of symbols) {
      const symbolBars = Array.isArray(bars[symbol]) ? bars[symbol] : [];
      for (const bar of symbolBars) {
        const row = normalizeBar(symbol, bar);
        if (row.some((value) => value === "" || value === undefined || Number.isNaN(value))) {
          throw new Error(`Alpaca returned an incomplete ${symbol} bar on page ${pageCount}`);
        }
        stream.write(`${row.map(csvValue).join(",")}\n`);
        rowCount += 1;
        rowsBySymbol[symbol] += 1;
      }
    }

    process.stdout.write(`\rpages: ${pageCount} rows: ${rowCount}`);
    pageToken = payload.next_page_token ?? "";
    if (!pageToken) break;
    if (maxPages !== null && pageCount >= maxPages) {
      console.log(`\nstopped at --max-pages ${maxPages}`);
      break;
    }
  }
} finally {
  stream.end();
  await once(stream, "finish");
}

console.log("");
for (const symbol of symbols) {
  console.log(`${symbol}: ${rowsBySymbol[symbol]} rows`);
}
console.log(`wrote: ${path.relative(root, targetPath)}`);
console.log("Next:");
console.log(`  pnpm validate:csv ${path.relative(root, targetPath)} --research-ready`);
console.log(`  pnpm import:csv ${path.relative(root, targetPath)} --replace-bars --research-ready`);
