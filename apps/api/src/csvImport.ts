import fs from "node:fs";

import type { Bar, Ticker } from "./schema";

type CsvRow = Record<string, string>;

function parseLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, ""));
}

export function parseBarsCsv(csv: string, source = "csv"): Bar[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const headers = parseLine(lines[0]).map((header) => header.toLowerCase());
  return lines.slice(1).map<Bar>((line) => {
    const values = parseLine(line);
    const row = headers.reduce<CsvRow>((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});

    return {
      ticker: row.ticker as Ticker,
      timeframe: "RAW" as const,
      timestamp: new Date(row.timestamp).toISOString(),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: Number(row.volume),
      source,
      adjusted: 1
    };
  }).filter((bar) =>
    (bar.ticker === "SOXL" || bar.ticker === "SOXS") &&
    Number.isFinite(bar.open) &&
    Number.isFinite(bar.high) &&
    Number.isFinite(bar.low) &&
    Number.isFinite(bar.close) &&
    Number.isFinite(bar.volume)
  );
}

export function readCsvFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}
