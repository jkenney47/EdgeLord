import { describe, expect, it } from "vitest";

import type { Bar, Trade } from "./api";
import { canCapture, getCaptureBlockReason } from "./captureRules";

const selected: Bar = {
  ticker: "SOXL",
  timeframe: "4H",
  timestamp: "2024-01-02T14:30:00.000Z",
  open: 28,
  high: 29,
  low: 27.5,
  close: 28.5,
  volume: 1000
};

const openSoxlTrade: Trade = {
  id: "trade-1",
  ticker: "SOXL",
  entry_label_id: "label-entry",
  exit_label_id: null,
  entry_timestamp: selected.timestamp,
  exit_timestamp: null,
  entry_price: 28.5,
  exit_price: null,
  return_pct: null,
  status: "open"
};

const earlierSelected: Bar = {
  ...selected,
  timestamp: "2024-01-01T14:30:00.000Z"
};

describe("capture rules", () => {
  it("requires a selected candle", () => {
    expect(canCapture("ENTRY", null, "SOXL", null)).toBe(false);
    expect(getCaptureBlockReason("ENTRY", null, "SOXL", null)).toBe("Select a candle to label.");
  });

  it("allows entry only while flat", () => {
    expect(canCapture("ENTRY", selected, "SOXL", null)).toBe(true);
    expect(canCapture("ENTRY", selected, "SOXS", openSoxlTrade)).toBe(false);
    expect(getCaptureBlockReason("ENTRY", selected, "SOXS", openSoxlTrade)).toBe(
      "Exit open SOXL trade before entering SOXS."
    );
  });

  it("allows exit only for the open trade ticker", () => {
    expect(canCapture("EXIT", selected, "SOXL", null)).toBe(false);
    expect(getCaptureBlockReason("EXIT", selected, "SOXL", null)).toBe("No open trade to exit.");
    expect(canCapture("EXIT", selected, "SOXS", openSoxlTrade)).toBe(false);
    expect(getCaptureBlockReason("EXIT", selected, "SOXS", openSoxlTrade)).toBe(
      "Open trade is SOXL; select SOXL to exit."
    );
    expect(canCapture("EXIT", selected, "SOXL", openSoxlTrade)).toBe(true);
  });

  it("blocks exits before the open trade entry candle", () => {
    expect(canCapture("EXIT", earlierSelected, "SOXL", openSoxlTrade)).toBe(false);
    expect(getCaptureBlockReason("EXIT", earlierSelected, "SOXL", openSoxlTrade)).toBe(
      "Exit candle is before open SOXL entry."
    );
  });

  it("blocks skip while a trade is open", () => {
    expect(canCapture("SKIP", selected, "SOXS", openSoxlTrade)).toBe(false);
    expect(getCaptureBlockReason("SKIP", selected, "SOXS", openSoxlTrade)).toBe(
      "Exit or continue open SOXL trade before recording SKIP."
    );
  });

  it("allows invalid whenever a candle is selected", () => {
    expect(canCapture("INVALID", selected, "SOXS", openSoxlTrade)).toBe(true);
  });
});
