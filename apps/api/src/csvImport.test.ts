import { describe, expect, it } from "vitest";

import { CsvImportValidationError, parseBarsCsv, resolveCsvImportPath } from "./csvImport";

const validCsv = [
  "ticker,timestamp,open,high,low,close,volume",
  "SOXL,2024-01-02T14:30:00.000Z,10,11,9,10.5,1000",
  "SOXS,2024-01-02T14:30:00.000Z,20,21,19,20.5,2000"
].join("\n");

describe("parseBarsCsv", () => {
  it("parses adjusted SOXL/SOXS rows into raw bars", () => {
    const bars = parseBarsCsv(validCsv, "csv");

    expect(bars).toHaveLength(2);
    expect(bars[0]).toMatchObject({
      ticker: "SOXL",
      timeframe: "RAW",
      timestamp: "2024-01-02T14:30:00.000Z",
      close: 10.5,
      source: "csv",
      adjusted: 1
    });
  });

  it("rejects missing required columns", () => {
    expect(() => parseBarsCsv("ticker,timestamp,close\nSOXL,2024-01-02T14:30:00.000Z,10")).toThrow(CsvImportValidationError);
  });

  it("rejects duplicate headers", () => {
    const csv = [
      "ticker,timestamp,open,high,low,close,volume,close",
      "SOXL,2024-01-02T14:30:00.000Z,10,11,9,10.5,1000,10.6"
    ].join("\n");

    expect(() => parseBarsCsv(csv)).toThrow(/duplicate columns: close/);
  });

  it("rejects rows with the wrong number of columns", () => {
    const csv = [
      "ticker,timestamp,open,high,low,close,volume",
      "SOXL,2024-01-02T14:30:00.000Z,10,11,9,10.5,1000,ignored"
    ].join("\n");

    expect(() => parseBarsCsv(csv)).toThrow(/expected 7 columns, found 8/);
  });

  it("rejects bad rows instead of silently dropping them", () => {
    const csv = [
      "ticker,timestamp,open,high,low,close,volume",
      "SPY,2024-01-02T14:30:00.000Z,10,11,9,10.5,1000",
      "SOXL,not-a-date,10,11,9,10.5,1000",
      "SOXS,2024-01-02T14:30:00.000Z,10,9,11,10.5,1000"
    ].join("\n");

    expect(() => parseBarsCsv(csv)).toThrow(CsvImportValidationError);
  });

  it("rejects duplicate ticker timestamps", () => {
    const csv = [
      "ticker,timestamp,open,high,low,close,volume",
      "SOXL,2024-01-02T14:30:00.000Z,10,11,9,10.5,1000",
      "SOXL,2024-01-02T14:30:00.000Z,10,11,9,10.5,1000"
    ].join("\n");

    expect(() => parseBarsCsv(csv)).toThrow(CsvImportValidationError);
  });

  it("rejects explicitly unadjusted rows", () => {
    const csv = [
      "ticker,timestamp,open,high,low,close,volume,adjusted",
      "SOXL,2024-01-02T14:30:00.000Z,10,11,9,10.5,1000,0"
    ].join("\n");

    expect(() => parseBarsCsv(csv)).toThrow(/unadjusted OHLCV rows are not allowed/);
  });
});

describe("resolveCsvImportPath", () => {
  const repoRoot = "/repo/EdgeLord";

  it("resolves repo-local CSV paths", () => {
    expect(resolveCsvImportPath(repoRoot, "data/bars.csv")).toBe("/repo/EdgeLord/data/bars.csv");
  });

  it("rejects paths outside the repository", () => {
    expect(() => resolveCsvImportPath(repoRoot, "../secrets.csv")).toThrow(/inside the repository/);
    expect(() => resolveCsvImportPath(repoRoot, "/tmp/bars.csv")).toThrow(/inside the repository/);
  });

  it("rejects non-CSV paths", () => {
    expect(() => resolveCsvImportPath(repoRoot, "data/.env")).toThrow(/\.csv/);
  });
});
