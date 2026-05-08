import type { Bar, ChartTimeframe } from "./schema";

type EasternParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const easternFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

function easternParts(date: Date): EasternParts {
  const parts = Object.fromEntries(easternFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  };
}

function easternOffsetMinutes(date: Date): number {
  const parts = easternParts(date);
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return (localAsUtc - date.getTime()) / 60_000;
}

function easternLocalIso(parts: EasternParts): string {
  const utcGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute));
  const offsetMinutes = easternOffsetMinutes(utcGuess);
  return new Date(utcGuess.getTime() - offsetMinutes * 60_000).toISOString();
}

function bucketTimestamp(timestamp: string, timeframe: ChartTimeframe): string {
  const date = new Date(timestamp);
  const local = easternParts(date);
  if (timeframe === "1D") {
    return easternLocalIso({ ...local, hour: 4, minute: 0 });
  }

  const totalMinutes = local.hour * 60 + local.minute;
  const sessionOpen = 4 * 60;
  const size = timeframe === "2H" ? 120 : 240;
  const offset = Math.max(0, totalMinutes - sessionOpen);
  const bucket = sessionOpen + Math.floor(offset / size) * size;
  return easternLocalIso({ ...local, hour: Math.floor(bucket / 60), minute: bucket % 60 });
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
