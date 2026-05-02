import { nanoid } from "nanoid";

import { aggregateRthBars } from "../aggregation/aggregateBars.js";
import type { SqliteDatabase } from "../db/database.js";
import type { AggregatedBar } from "../aggregation/aggregateBars.js";
import type { BaseBar, BaseTimeframe, MarketDataProvider } from "./types.js";

export type ImportMarketDataRequest = {
  tickers: string[];
  startDate: string;
  endDate: string;
  baseTimeframe: BaseTimeframe;
  chunkDelayMs?: number;
};

export type ImportMarketDataResult = {
  importRunId: string;
  provider: string;
  tickers: string[];
  baseBarsInserted: number;
  aggregatedBarsInserted: number;
  alignedTimestamps: string[];
  warnings: string[];
};

export type ImportMarketDataOptions = {
  db: SqliteDatabase;
  providerName: string;
  provider: MarketDataProvider;
  request: ImportMarketDataRequest;
};

const SUPPORTED_TIMEFRAMES = ["2H", "4H", "1D"] as const;
const IMPORT_CHUNK_DAYS = 14;

function endOfDateUtc(date: string): Date {
  return new Date(`${date}T23:59:59.999Z`);
}

function startOfDateUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function splitDateRange(startDate: string, endDate: string): Array<{ startDate: string; endDate: string }> {
  const chunks: Array<{ startDate: string; endDate: string }> = [];
  let cursor = startOfDateUtc(startDate);
  const end = startOfDateUtc(endDate);

  while (cursor <= end) {
    const chunkEnd = new Date(Math.min(addUtcDays(cursor, IMPORT_CHUNK_DAYS - 1).getTime(), end.getTime()));
    chunks.push({
      startDate: formatDateUtc(cursor),
      endDate: formatDateUtc(chunkEnd)
    });
    cursor = addUtcDays(chunkEnd, 1);
  }

  return chunks;
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function insertBaseBars(
  db: SqliteDatabase,
  providerName: string,
  timeframe: BaseTimeframe,
  bars: BaseBar[]
): number {
  const statement = db.prepare(
    `insert into base_bars (
      provider,
      ticker,
      timeframe,
      timestamp,
      open,
      high,
      low,
      close,
      volume,
      created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(provider, ticker, timeframe, timestamp) do update set
      open = excluded.open,
      high = excluded.high,
      low = excluded.low,
      close = excluded.close,
      volume = excluded.volume`
  );
  const now = new Date().toISOString();
  let changed = 0;

  const insert = db.transaction(() => {
    for (const bar of bars) {
      const result = statement.run(
        providerName,
        bar.ticker,
        timeframe,
        bar.timestamp,
        bar.open,
        bar.high,
        bar.low,
        bar.close,
        bar.volume,
        now
      );
      changed += result.changes;
    }
  });

  insert();
  return changed;
}

function insertAggregatedBars(db: SqliteDatabase, bars: AggregatedBar[]): number {
  const statement = db.prepare(
    `insert into aggregated_bars (
      ticker,
      timeframe,
      timestamp,
      open,
      high,
      low,
      close,
      volume,
      source_bar_count,
      created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(ticker, timeframe, timestamp) do update set
      open = excluded.open,
      high = excluded.high,
      low = excluded.low,
      close = excluded.close,
      volume = excluded.volume,
      source_bar_count = excluded.source_bar_count`
  );
  const now = new Date().toISOString();
  let changed = 0;

  const insert = db.transaction(() => {
    for (const bar of bars) {
      const result = statement.run(
        bar.ticker,
        bar.timeframe,
        bar.timestamp,
        bar.open,
        bar.high,
        bar.low,
        bar.close,
        bar.volume,
        bar.sourceBarCount,
        now
      );
      changed += result.changes;
    }
  });

  insert();
  return changed;
}

function deleteAggregatedBarsForRequest(db: SqliteDatabase, request: ImportMarketDataRequest): void {
  if (request.tickers.length === 0) {
    return;
  }

  db.prepare(
    `delete from aggregated_bars
      where ticker in (${request.tickers.map(() => "?").join(",")})
        and timeframe in (${SUPPORTED_TIMEFRAMES.map(() => "?").join(",")})
        and timestamp >= ?
        and timestamp <= ?`
  ).run(
    ...request.tickers,
    ...SUPPORTED_TIMEFRAMES,
    `${request.startDate}T00:00:00.000Z`,
    `${request.endDate}T23:59:59.999Z`
  );
}

function alignedTimestampsForTickers(bars: AggregatedBar[], tickers: string[]): string[] {
  const timestampsByTicker = new Map<string, Set<string>>();

  for (const ticker of tickers) {
    timestampsByTicker.set(ticker, new Set());
  }

  for (const bar of bars) {
    timestampsByTicker.get(bar.ticker)?.add(bar.timestamp);
  }

  const [firstTicker, ...restTickers] = tickers;
  const firstSet = timestampsByTicker.get(firstTicker) ?? new Set<string>();

  return [...firstSet]
    .filter((timestamp) =>
      restTickers.every((ticker) => timestampsByTicker.get(ticker)?.has(timestamp))
    )
    .sort();
}

function alignedTimestampsByTimeframe(
  bars: AggregatedBar[],
  tickers: string[]
): Record<string, string[]> {
  return Object.fromEntries(
    SUPPORTED_TIMEFRAMES.map((timeframe) => [
      timeframe,
      alignedTimestampsForTickers(
        bars.filter((bar) => bar.timeframe === timeframe),
        tickers
      )
    ])
  );
}

function cachedAggregatedBarsForRequest(
  db: SqliteDatabase,
  request: ImportMarketDataRequest
): AggregatedBar[] {
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
      where ticker in (${request.tickers.map(() => "?").join(",")})
        and timestamp >= ?
        and timestamp <= ?
      order by ticker asc, timeframe asc, timestamp asc`
    )
    .all(...request.tickers, `${request.startDate}T00:00:00.000Z`, `${request.endDate}T23:59:59.999Z`) as Array<{
    ticker: string;
    timeframe: AggregatedBar["timeframe"];
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    source_bar_count: number;
  }>;

  return rows.map((row) => ({
    ticker: row.ticker,
    timeframe: row.timeframe,
    timestamp: row.timestamp,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    sourceBarCount: row.source_bar_count
  }));
}

function alignedTimestampsByTimeframeFromCache(
  db: SqliteDatabase,
  request: ImportMarketDataRequest
): Record<string, string[]> {
  return alignedTimestampsByTimeframe(cachedAggregatedBarsForRequest(db, request), request.tickers);
}

function createImportRun(
  db: SqliteDatabase,
  request: ImportMarketDataRequest,
  providerName: string
): string {
  const id = nanoid();
  const now = new Date().toISOString();

  db.prepare(
    `insert into import_runs (
      id,
      provider,
      tickers_json,
      start_date,
      end_date,
      base_timeframe,
      status,
      created_at,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    providerName,
    JSON.stringify(request.tickers),
    request.startDate,
    request.endDate,
    request.baseTimeframe,
    "running",
    now,
    now
  );

  return id;
}

function completeImportRun(
  db: SqliteDatabase,
  importRunId: string,
  result: Omit<ImportMarketDataResult, "importRunId">
): void {
  db.prepare(
    `update import_runs
      set status = ?,
        result_json = ?,
        updated_at = ?
      where id = ?`
  ).run("completed", JSON.stringify(result), new Date().toISOString(), importRunId);
}

function failImportRun(db: SqliteDatabase, importRunId: string, error: unknown): void {
  db.prepare(
    `update import_runs
      set status = ?,
        error = ?,
        updated_at = ?
      where id = ?`
  ).run(
    "failed",
    error instanceof Error ? error.message : "Unknown import failure",
    new Date().toISOString(),
    importRunId
  );
}

export async function importMarketData(
  options: ImportMarketDataOptions
): Promise<ImportMarketDataResult> {
  const importRunId = createImportRun(options.db, options.request, options.providerName);

  try {
    let baseBarsInserted = 0;
    let aggregatedBarsInserted = 0;
    const baseBarsByChunk: BaseBar[][] = [];

    const chunks = splitDateRange(options.request.startDate, options.request.endDate);
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      if (index > 0) {
        await sleep(options.request.chunkDelayMs ?? 0);
      }
      const baseBars = await options.provider.getBars({
        tickers: options.request.tickers,
        timeframe: options.request.baseTimeframe,
        start: startOfDateUtc(chunk.startDate),
        end: endOfDateUtc(chunk.endDate)
      });
      baseBarsByChunk.push(baseBars);
    }

    deleteAggregatedBarsForRequest(options.db, options.request);

    for (const baseBars of baseBarsByChunk) {
      baseBarsInserted += insertBaseBars(
        options.db,
        options.providerName,
        options.request.baseTimeframe,
        baseBars
      );

      const aggregatedBars = SUPPORTED_TIMEFRAMES.flatMap((timeframe) =>
        aggregateRthBars(baseBars, timeframe, options.request.baseTimeframe)
      );
      aggregatedBarsInserted += insertAggregatedBars(options.db, aggregatedBars);
    }

    const alignedByTimeframe = alignedTimestampsByTimeframeFromCache(options.db, options.request);
    const alignedTimestamps = alignedByTimeframe["4H"];
    const warnings =
      options.request.tickers.length > 1
        ? Object.entries(alignedByTimeframe)
            .filter(([, timestamps]) => timestamps.length === 0)
            .map(
              ([timeframe]) =>
                `No aligned ${timeframe} timestamps found for requested tickers: ${options.request.tickers.join(", ")}`
            )
        : [];
    const resultWithoutRunId = {
      provider: options.providerName,
      tickers: options.request.tickers,
      baseBarsInserted,
      aggregatedBarsInserted,
      alignedTimestamps,
      warnings
    };

    completeImportRun(options.db, importRunId, resultWithoutRunId);

    return {
      importRunId,
      ...resultWithoutRunId
    };
  } catch (error) {
    failImportRun(options.db, importRunId, error);
    throw error;
  }
}
