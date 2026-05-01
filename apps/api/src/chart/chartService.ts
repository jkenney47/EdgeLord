import { computeIndicatorSnapshots } from "../indicators/indicatorEngine.js";
import type { SqliteDatabase } from "../db/database.js";
import type { AggregatedBar } from "../aggregation/aggregateBars.js";
import type { AggregatedTimeframe } from "../aggregation/aggregateBars.js";
import type { IndicatorSnapshot } from "../indicators/indicatorEngine.js";
import {
  detectAggregatedBarDiscontinuities,
  type DataQualityWarning
} from "../market-data/dataQuality.js";

type AggregatedBarRow = {
  ticker: string;
  timeframe: AggregatedTimeframe;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source_bar_count: number;
};

export type ChartSeries = {
  ticker: string;
  timeframe: AggregatedTimeframe;
  candles: AggregatedBar[];
  indicators: IndicatorSnapshot[];
};

export type SyncChartResponse = {
  timeframe: AggregatedTimeframe;
  tickers: string[];
  timestamps: string[];
  series: Record<string, ChartSeries>;
  warnings: DataQualityWarning[];
};

export type DataCoverageSummary = {
  ticker: string;
  timeframe: AggregatedTimeframe;
  barCount: number;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  gapCount: number;
  largestGapDays: number;
};

export type DataCoverageGap = {
  ticker: string;
  timeframe: AggregatedTimeframe;
  previousTimestamp: string;
  timestamp: string;
  gapDays: number;
};

export type DataCoverageReport = {
  tickers: string[];
  timeframes: AggregatedTimeframe[];
  summaries: DataCoverageSummary[];
  gaps: DataCoverageGap[];
};

type CoverageRow = {
  ticker: string;
  timeframe: AggregatedTimeframe;
  timestamp: string;
};

const LARGE_COVERAGE_GAP_DAYS = 10;

function rowToAggregatedBar(row: AggregatedBarRow): AggregatedBar {
  return {
    ticker: row.ticker,
    timeframe: row.timeframe,
    timestamp: row.timestamp,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    sourceBarCount: row.source_bar_count
  };
}

export function getChartSeries(
  db: SqliteDatabase,
  ticker: string,
  timeframe: AggregatedTimeframe
): ChartSeries {
  const rows = db
    .prepare(
      `select ticker,
        timeframe,
        timestamp,
        open,
        high,
        low,
        close,
        volume,
        source_bar_count
      from aggregated_bars
      where ticker = ? and timeframe = ?
      order by timestamp asc`
    )
    .all(ticker, timeframe) as AggregatedBarRow[];
  const candles = rows.map(rowToAggregatedBar);

  return {
    ticker,
    timeframe,
    candles,
    indicators: computeIndicatorSnapshots(candles)
  };
}

function filterSeriesToTimestamps(series: ChartSeries, timestamps: Set<string>): ChartSeries {
  const candles = series.candles.filter((bar) => timestamps.has(bar.timestamp));

  return {
    ...series,
    candles,
    indicators: computeIndicatorSnapshots(candles)
  };
}

export function getSynchronizedChartSeries(
  db: SqliteDatabase,
  tickers: string[],
  timeframe: AggregatedTimeframe
): SyncChartResponse {
  const rawSeries = Object.fromEntries(
    tickers.map((ticker) => [ticker, getChartSeries(db, ticker, timeframe)])
  );
  const [firstTicker, ...restTickers] = tickers;
  const firstTimestamps = new Set(rawSeries[firstTicker]?.candles.map((bar) => bar.timestamp) ?? []);
  const commonTimestamps = [...firstTimestamps]
    .filter((timestamp) =>
      restTickers.every((ticker) =>
        rawSeries[ticker]?.candles.some((bar) => bar.timestamp === timestamp)
      )
    )
    .sort();
  const commonTimestampSet = new Set(commonTimestamps);

  return {
    timeframe,
    tickers,
    timestamps: commonTimestamps,
    series: Object.fromEntries(
      Object.entries(rawSeries).map(([ticker, series]) => [
        ticker,
        filterSeriesToTimestamps(series, commonTimestampSet)
      ])
    ),
    warnings: detectAggregatedBarDiscontinuities(db, {
      tickers,
      timeframes: [timeframe]
    })
  };
}

export function getDataCoverage(
  db: SqliteDatabase,
  tickers: string[],
  timeframes: AggregatedTimeframe[]
): DataCoverageReport {
  const rows = db
    .prepare(
      `select ticker,
        timeframe,
        timestamp
      from aggregated_bars
      where ticker in (${tickers.map(() => "?").join(",")})
        and timeframe in (${timeframes.map(() => "?").join(",")})
      order by ticker asc, timeframe asc, timestamp asc`
    )
    .all(...tickers, ...timeframes) as CoverageRow[];
  const rowsByKey = new Map<string, CoverageRow[]>();

  for (const row of rows) {
    const key = `${row.ticker}:${row.timeframe}`;
    rowsByKey.set(key, [...(rowsByKey.get(key) ?? []), row]);
  }

  const gaps: DataCoverageGap[] = [];
  const summaries = tickers.flatMap((ticker) =>
    timeframes.map((timeframe) => {
      const scopedRows = rowsByKey.get(`${ticker}:${timeframe}`) ?? [];
      let largestGapDays = 0;
      let gapCount = 0;

      for (let index = 1; index < scopedRows.length; index += 1) {
        const previousTimestamp = scopedRows[index - 1].timestamp;
        const timestamp = scopedRows[index].timestamp;
        const gapDays = Math.round(
          (new Date(timestamp).getTime() - new Date(previousTimestamp).getTime()) / 86_400_000
        );

        largestGapDays = Math.max(largestGapDays, gapDays);
        if (gapDays > LARGE_COVERAGE_GAP_DAYS) {
          gapCount += 1;
          gaps.push({
            ticker,
            timeframe,
            previousTimestamp,
            timestamp,
            gapDays
          });
        }
      }

      return {
        ticker,
        timeframe,
        barCount: scopedRows.length,
        firstTimestamp: scopedRows[0]?.timestamp ?? null,
        lastTimestamp: scopedRows.at(-1)?.timestamp ?? null,
        gapCount,
        largestGapDays
      };
    })
  );

  return {
    tickers,
    timeframes,
    summaries,
    gaps
  };
}
