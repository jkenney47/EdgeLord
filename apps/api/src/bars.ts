import { db } from "./db";
import { aggregateBars } from "./aggregate";
import type { Bar, ChartTimeframe, Ticker } from "./schema";

export type BarSummaryRow = {
  ticker: Ticker;
  timeframe: string;
  source: string;
  bars: number;
  first: string | null;
  last: string | null;
};

const insertBar = db.prepare(`
  insert into bars (ticker, timeframe, timestamp, open, high, low, close, volume, source, adjusted)
  values (@ticker, @timeframe, @timestamp, @open, @high, @low, @close, @volume, @source, @adjusted)
  on conflict(ticker, timeframe, timestamp) do update set
    open = excluded.open,
    high = excluded.high,
    low = excluded.low,
    close = excluded.close,
    volume = excluded.volume,
    source = excluded.source,
    adjusted = excluded.adjusted
`);

export function saveBars(bars: Bar[]): number {
  const transaction = db.transaction((items: Bar[]) => {
    for (const bar of items) {
      insertBar.run(bar);
    }
  });

  transaction(bars);
  return bars.length;
}

export function clearBars(): number {
  const row = db.prepare("select count(*) as count from bars").get() as { count: number };
  db.prepare("delete from bars").run();
  return row.count;
}

export function importRawBars(rawBars: Bar[]): { rawInserted: number; aggregateInserted: number } {
  const rawInserted = saveBars(rawBars);
  const aggregateInserted = (["2H", "4H", "1D"] as ChartTimeframe[]).reduce((count, timeframe) => {
    const aggregated = aggregateBars(rawBars, timeframe);
    saveBars(aggregated);
    return count + aggregated.length;
  }, 0);
  return { rawInserted, aggregateInserted };
}

export function getBars(ticker: Ticker, timeframe: ChartTimeframe): Bar[] {
  return db.prepare(`
    select * from bars
    where ticker = ? and timeframe = ?
    order by timestamp asc
  `).all(ticker, timeframe) as Bar[];
}

export function getBarsSummary(): BarSummaryRow[] {
  return db.prepare(`
    select
      ticker,
      timeframe,
      source,
      count(*) as bars,
      min(timestamp) as first,
      max(timestamp) as last
    from bars
    group by ticker, timeframe, source
    order by ticker asc, timeframe asc, source asc
  `).all() as BarSummaryRow[];
}

export function getBarIndex(ticker: Ticker, timeframe: ChartTimeframe, timestamp: string): number {
  const bars = getBars(ticker, timeframe);
  return bars.findIndex((bar) => bar.timestamp === timestamp);
}

export function hasChartBars(): boolean {
  const row = db.prepare("select count(*) as count from bars where timeframe in ('2H', '4H', '1D')").get() as { count: number };
  return row.count > 0;
}
