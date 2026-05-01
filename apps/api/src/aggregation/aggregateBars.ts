import {
  isRegularTradingMinute,
  sessionDateForTimestamp,
  sessionOpenForDate
} from "./rthCalendar.js";
import type { BaseBar } from "../market-data/types.js";
import type { BaseTimeframe } from "../market-data/types.js";

export type AggregatedTimeframe = "2H" | "4H" | "1D";

export type AggregatedBar = {
  ticker: string;
  timeframe: AggregatedTimeframe;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sourceBarCount: number;
};

const TIMEFRAME_MINUTES: Record<AggregatedTimeframe, number> = {
  "2H": 120,
  "4H": 240,
  "1D": 390
};
const BASE_TIMEFRAME_MINUTES: Record<BaseTimeframe, number> = {
  "1Min": 1,
  "5Min": 5
};
const MIN_BUCKET_COVERAGE_RATIO = 0.8;

function minutesBetween(startIso: string, endIso: string): number {
  return Math.floor((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
}

function buildAggregatedBar(
  ticker: string,
  timeframe: AggregatedTimeframe,
  bucketStart: string,
  bars: BaseBar[],
  sourceMinutes: number
): AggregatedBar {
  return {
    ticker,
    timeframe,
    timestamp: bucketStart,
    open: bars[0].open,
    high: Math.max(...bars.map((bar) => bar.high)),
    low: Math.min(...bars.map((bar) => bar.low)),
    close: bars[bars.length - 1].close,
    volume: bars.reduce((sum, bar) => sum + bar.volume, 0),
    sourceBarCount: bars.length * sourceMinutes
  };
}

export function aggregateRthBars(
  baseBars: BaseBar[],
  timeframe: AggregatedTimeframe,
  baseTimeframe: BaseTimeframe = "1Min"
): AggregatedBar[] {
  const timeframeMinutes = TIMEFRAME_MINUTES[timeframe];
  const sourceMinutes = BASE_TIMEFRAME_MINUTES[baseTimeframe];
  const expectedSourceBars = timeframeMinutes / sourceMinutes;
  const buckets = new Map<string, BaseBar[]>();

  const sortedBars = [...baseBars]
    .filter((bar) => isRegularTradingMinute(bar.timestamp))
    .sort((a, b) => {
      if (a.ticker !== b.ticker) {
        return a.ticker.localeCompare(b.ticker);
      }

      return a.timestamp.localeCompare(b.timestamp);
    });

  for (const bar of sortedBars) {
    const sessionDate = sessionDateForTimestamp(bar.timestamp);
    const sessionOpen = sessionOpenForDate(sessionDate);
    const minutesFromOpen = minutesBetween(sessionOpen, bar.timestamp);
    const bucketIndex = Math.floor(minutesFromOpen / timeframeMinutes);
    const bucketStart = new Date(
      new Date(sessionOpen).getTime() + bucketIndex * timeframeMinutes * 60_000
    ).toISOString();
    const bucketKey = `${bar.ticker}|${bucketStart}`;
    const bucketBars = buckets.get(bucketKey) ?? [];
    bucketBars.push(bar);
    buckets.set(bucketKey, bucketBars);
  }

  return [...buckets.entries()]
    .filter(([, bars]) => bars.length >= expectedSourceBars * MIN_BUCKET_COVERAGE_RATIO)
    .map(([key, bars]) => {
      const [ticker, bucketStart] = key.split("|");
      return buildAggregatedBar(ticker, timeframe, bucketStart, bars, sourceMinutes);
    })
    .sort((a, b) => {
      if (a.ticker !== b.ticker) {
        return a.ticker.localeCompare(b.ticker);
      }

      return a.timestamp.localeCompare(b.timestamp);
    });
}
