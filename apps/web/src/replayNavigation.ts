import type { Bar, Label, Timeframe, Ticker } from "./api";

export function findReplayResumeIndex(
  bars: Bar[],
  labels: Label[],
  ticker: Ticker,
  timeframe: Timeframe
): number {
  if (bars.length === 0) return 0;
  const labeledTimestamps = new Set(
    labels
      .filter((label) => label.ticker === ticker && label.timeframe === timeframe)
      .map((label) => label.timestamp)
  );
  let latestLabeledIndex = -1;
  for (const [index, bar] of bars.entries()) {
    if (labeledTimestamps.has(bar.timestamp)) {
      latestLabeledIndex = index;
    }
  }
  return Math.min(latestLabeledIndex + 1, bars.length - 1);
}

export function findNextUnlabeledIndex(
  bars: Bar[],
  labels: Label[],
  ticker: Ticker,
  timeframe: Timeframe,
  currentIndex: number
): number | null {
  const labeledTimestamps = new Set(
    labels
      .filter((label) => label.ticker === ticker && label.timeframe === timeframe)
      .map((label) => label.timestamp)
  );
  const startIndex = Math.max(0, currentIndex + 1);
  for (let index = startIndex; index < bars.length; index += 1) {
    if (!labeledTimestamps.has(bars[index].timestamp)) {
      return index;
    }
  }
  return null;
}

export function findFirstIndexAfterTimestamp(bars: Bar[], timestamp: string): number | null {
  const nextIndex = bars.findIndex((bar) => bar.timestamp > timestamp);
  return nextIndex >= 0 ? nextIndex : null;
}
