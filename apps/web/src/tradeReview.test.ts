import { describe, expect, it } from "vitest";

import type { Bar, Trade } from "./api";
import { getOpenTradeSelectionContext } from "./tradeReview";

const selected: Bar = {
  ticker: "SOXL",
  timeframe: "4H",
  timestamp: "2024-01-03T14:30:00.000Z",
  open: 10.5,
  high: 11.25,
  low: 10.25,
  close: 11,
  volume: 1000
};

const openTrade: Trade = {
  id: "trade-1",
  ticker: "SOXL",
  entry_label_id: "entry-1",
  exit_label_id: null,
  entry_timestamp: "2024-01-02T14:30:00.000Z",
  exit_timestamp: null,
  entry_price: 10,
  exit_price: null,
  return_pct: null,
  status: "open"
};

describe("getOpenTradeSelectionContext", () => {
  it("returns null without a selected candle or open trade", () => {
    expect(getOpenTradeSelectionContext(null, openTrade, "SOXL")).toBeNull();
    expect(getOpenTradeSelectionContext(selected, null, "SOXL")).toBeNull();
  });

  it("summarizes selected candle return for the open trade ticker", () => {
    expect(getOpenTradeSelectionContext(selected, openTrade, "SOXL")).toEqual({
      tone: "active",
      title: "Reviewing SOXL exit",
      detail: "Entry 2024-01-02 at 10.00; selected close 11.00.",
      returnPct: 10
    });
  });

  it("warns when another ticker is selected while a trade is open", () => {
    expect(getOpenTradeSelectionContext({ ...selected, ticker: "SOXS" }, openTrade, "SOXS")).toEqual({
      tone: "warn",
      title: "Open SOXL trade",
      detail: "Switch to SOXL to review the exit. Opposite entries stay blocked until it is closed.",
      returnPct: null
    });
  });

  it("warns when the selected candle is before the open entry", () => {
    expect(getOpenTradeSelectionContext({ ...selected, timestamp: "2024-01-01T14:30:00.000Z" }, openTrade, "SOXL")).toEqual({
      tone: "warn",
      title: "Before open entry",
      detail: "Entry is 2024-01-02 at 10.00.",
      returnPct: null
    });
  });
});
