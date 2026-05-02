import type { Bar, Label, LabelAction, LabelSource, Ticker, Trade } from "./api";

export function getCaptureBlockReason(
  action: LabelAction,
  selected: Bar | null,
  ticker: Ticker,
  openTrade: Trade | null,
  selectedLabels: Label[] = [],
  labelSource?: LabelSource
): string | null {
  if (!selected) return "Select a candle to label.";
  if (labelSource) {
    const existing = selectedLabels.find((label) => label.label_source === labelSource);
    if (existing) {
      return `${sourceLabel(labelSource)} already has a ${existing.action} label on this candle. Use undo or select another source.`;
    }
  }
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

export function canCapture(
  action: LabelAction,
  selected: Bar | null,
  ticker: Ticker,
  openTrade: Trade | null,
  selectedLabels: Label[] = [],
  labelSource?: LabelSource
): boolean {
  return getCaptureBlockReason(action, selected, ticker, openTrade, selectedLabels, labelSource) === null;
}

function sourceLabel(source: LabelSource): string {
  if (source === "actual_trade") return "Actual trade";
  if (source === "retrospective_replay") return "Retrospective replay";
  return "Retrospective hindsight";
}
