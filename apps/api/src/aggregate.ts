import type { Bar, ChartTimeframe } from "./schema";

function bucketTimestamp(timestamp: string, timeframe: ChartTimeframe): string {
  const date = new Date(timestamp);
  if (timeframe === "1D") {
    date.setUTCHours(14, 30, 0, 0);
    return date.toISOString();
  }

  const totalMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const marketOpen = 14 * 60 + 30;
  const size = timeframe === "2H" ? 120 : 240;
  const offset = Math.max(0, totalMinutes - marketOpen);
  const bucket = marketOpen + Math.floor(offset / size) * size;
  date.setUTCHours(Math.floor(bucket / 60), bucket % 60, 0, 0);
  return date.toISOString();
}

export function aggregateBars(rawBars: Bar[], timeframe: ChartTimeframe): Bar[] {
  const groups = new Map<string, Bar[]>();

  for (const bar of rawBars) {
    const key = `${bar.ticker}|${bucketTimestamp(bar.timestamp, timeframe)}`;
    groups.set(key, [...(groups.get(key) ?? []), bar]);
  }

  return [...groups.entries()]
    .map(([key, bars]) => {
      const [ticker, timestamp] = key.split("|");
      const sorted = [...bars].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      return {
        ticker: ticker as Bar["ticker"],
        timeframe,
        timestamp,
        open: sorted[0].open,
        high: Math.max(...sorted.map((bar) => bar.high)),
        low: Math.min(...sorted.map((bar) => bar.low)),
        close: sorted.at(-1)?.close ?? sorted[0].close,
        volume: sorted.reduce((sum, bar) => sum + bar.volume, 0),
        source: "aggregate",
        adjusted: 1
      };
    })
    .sort((a, b) => a.ticker.localeCompare(b.ticker) || a.timestamp.localeCompare(b.timestamp));
}
