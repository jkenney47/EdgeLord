import fs from "node:fs";
import path from "node:path";

import type { Bar, Ticker } from "./schema";

type CsvRow = Record<string, string>;
const requiredColumns = ["ticker", "timestamp", "open", "high", "low", "close", "volume"] as const;
const adjustedTrueValues = new Set(["", "1", "true", "yes", "y", "adjusted"]);

export class CsvImportValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`CSV import failed validation: ${issues.slice(0, 5).join("; ")}`);
    this.name = "CsvImportValidationError";
    this.issues = issues;
  }
}

export class CsvImportPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvImportPathError";
  }
}

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
    throw new CsvImportValidationError(["CSV must include a header and at least one data row"]);
  }

  const headers = parseLine(lines[0]).map((header) => header.toLowerCase());
  const missingColumns = requiredColumns.filter((column) => !headers.includes(column));
  if (missingColumns.length > 0) {
    throw new CsvImportValidationError([`CSV missing required columns: ${missingColumns.join(", ")}`]);
  }

  const issues: string[] = [];
  const seen = new Set<string>();
  const bars: Bar[] = [];

  for (const [lineIndex, line] of lines.slice(1).entries()) {
    const rowNumber = lineIndex + 2;
    const values = parseLine(line);
    const row = headers.reduce<CsvRow>((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});

    const ticker = row.ticker as Ticker;
    const timestamp = new Date(row.timestamp);
    const open = Number(row.open);
    const high = Number(row.high);
    const low = Number(row.low);
    const close = Number(row.close);
    const volume = Number(row.volume);
    const adjusted = row.adjusted === undefined ? 1 : adjustedTrueValues.has(row.adjusted.trim().toLowerCase()) ? 1 : 0;

    if (ticker !== "SOXL" && ticker !== "SOXS") {
      issues.push(`row ${rowNumber}: unsupported ticker ${row.ticker || "(blank)"}`);
      continue;
    }
    if (Number.isNaN(timestamp.getTime())) {
      issues.push(`row ${rowNumber}: invalid timestamp ${row.timestamp || "(blank)"}`);
      continue;
    }
    if (![open, high, low, close, volume].every(Number.isFinite)) {
      issues.push(`row ${rowNumber}: invalid OHLCV number`);
      continue;
    }
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) {
      issues.push(`row ${rowNumber}: OHLCV values must be positive, with non-negative volume`);
      continue;
    }
    if (high < Math.max(open, close) || low > Math.min(open, close) || high < low) {
      issues.push(`row ${rowNumber}: OHLC values are internally inconsistent`);
      continue;
    }
    if (adjusted !== 1) {
      issues.push(`row ${rowNumber}: unadjusted OHLCV rows are not allowed; import split/dividend-adjusted data only`);
      continue;
    }

    const isoTimestamp = timestamp.toISOString();
    const key = `${ticker}:${isoTimestamp}`;
    if (seen.has(key)) {
      issues.push(`row ${rowNumber}: duplicate ${ticker} timestamp ${isoTimestamp}`);
      continue;
    }
    seen.add(key);

    bars.push({
      ticker: row.ticker as Ticker,
      timeframe: "RAW" as const,
      timestamp: isoTimestamp,
      open,
      high,
      low,
      close,
      volume,
      source,
      adjusted
    });
  }

  if (issues.length > 0) {
    throw new CsvImportValidationError(issues);
  }
  if (bars.length === 0) {
    throw new CsvImportValidationError(["CSV did not contain any importable SOXL/SOXS rows"]);
  }

  return bars;
}

export function readCsvFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

export function resolveCsvImportPath(repoRoot: string, requestedPath: string): string {
  const trimmedPath = requestedPath.trim();
  if (!trimmedPath) {
    throw new CsvImportPathError("CSV import path is required.");
  }

  const resolvedPath = path.resolve(repoRoot, trimmedPath);
  const relativePath = path.relative(repoRoot, resolvedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new CsvImportPathError("CSV import path must stay inside the repository.");
  }

  if (path.extname(resolvedPath).toLowerCase() !== ".csv") {
    throw new CsvImportPathError("CSV import path must point to a .csv file.");
  }

  return resolvedPath;
}
