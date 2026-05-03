import type { Timeframe, Ticker } from "./api";

export type PendingSelectionTarget = {
  ticker: Ticker;
  timeframe: Timeframe;
};

export function shouldDeferBarResetForPendingSelection(
  pending: PendingSelectionTarget | null,
  ticker: Ticker,
  timeframe: Timeframe
): boolean {
  return pending?.ticker === ticker && pending.timeframe === timeframe;
}
