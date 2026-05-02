import { describe, expect, it } from "vitest";

import { CsvImportValidationError, parseBarsCsv } from "./csvImport";

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
});
