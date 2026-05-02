import type { Bar, LabelAction, Ticker, Trade } from "./api";

export function getCaptureBlockReason(
  action: LabelAction,
  selected: Bar | null,
  ticker: Ticker,
  openTrade: Trade | null
): string | null {
  if (!selected) return "Select a candle to label.";
  if (action === "ENTRY" && openTrade) {
    return `Exit open ${openTrade.ticker} trade before entering ${ticker}.`;
  }
  if (action === "SKIP" && openTrade) {
    return `Exit or continue open ${openTrade.ticker} trade before recording SKIP.`;
  }
  if (action === "EXIT") {
    if (!openTrade) return "No open trade to exit.";
    if (openTrade.ticker !== ticker) {
      return `Open trade is ${openTrade.ticker}; select ${openTrade.ticker} to exit.`;
    }
    if (selected.timestamp < openTrade.entry_timestamp) {
      return `Exit candle is before open ${openTrade.ticker} entry.`;
    }
  }
  return null;
}

export function canCapture(action: LabelAction, selected: Bar | null, ticker: Ticker, openTrade: Trade | null): boolean {
  return getCaptureBlockReason(action, selected, ticker, openTrade) === null;
}
