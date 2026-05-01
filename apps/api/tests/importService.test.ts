import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { runMigrations } from "../src/db/migrate.js";
import { importMarketData } from "../src/market-data/importService.js";
import type { BaseBar, MarketDataProvider } from "../src/market-data/types.js";

let db: Database.Database | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

function minuteBars({
  ticker,
  start,
  count,
  baseOpen = 100
}: {
  ticker: string;
  start: string;
  count: number;
  baseOpen?: number;
}): BaseBar[] {
  const startMs = new Date(start).getTime();

  return Array.from({ length: count }, (_, index) => {
    const open = baseOpen + index;
    return {
      ticker,
      timestamp: new Date(startMs + index * 60_000).toISOString(),
      open,
      high: open + 2,
      low: open - 1,
      close: open + 1,
      volume: 10 + index
    };
  });
}

function fakeProvider(bars: BaseBar[]): MarketDataProvider {
  return {
    async getBars() {
      return bars;
    }
  };
}

function countRows(database: Database.Database, table: string): number {
  return (database.prepare(`select count(*) as count from ${table}`).get() as { count: number }).count;
}

describe("importMarketData", () => {
  it("persists base bars, supported aggregates, and a completed import run", async () => {
    db = new Database(":memory:");
    runMigrations(db);

    const result = await importMarketData({
      db,
      providerName: "alpaca",
      provider: fakeProvider([
        ...minuteBars({
          ticker: "SOXL",
          start: "2024-01-02T14:30:00.000Z",
          count: 390,
          baseOpen: 100
        }),
        ...minuteBars({
          ticker: "SOXS",
          start: "2024-01-02T14:30:00.000Z",
          count: 390,
          baseOpen: 200
        })
      ]),
      request: {
        tickers: ["SOXL", "SOXS"],
        startDate: "2024-01-02",
        endDate: "2024-01-02",
        baseTimeframe: "1Min"
      }
    });

    expect(result).toMatchObject({
      provider: "alpaca",
      tickers: ["SOXL", "SOXS"],
      baseBarsInserted: 780,
      aggregatedBarsInserted: 10,
      alignedTimestamps: ["2024-01-02T14:30:00.000Z"],
      warnings: []
    });

    expect(countRows(db, "base_bars")).toBe(780);
    expect(countRows(db, "aggregated_bars")).toBe(10);
    expect(countRows(db, "import_runs")).toBe(1);

    const run = db
      .prepare("select status, result_json from import_runs")
      .get() as { status: string; result_json: string };
    expect(run.status).toBe("completed");
    expect(JSON.parse(run.result_json)).toMatchObject({
      baseBarsInserted: 780,
      aggregatedBarsInserted: 10
    });
  });

  it("reports an alignment warning when a ticker has no matching completed 4H candle", async () => {
    db = new Database(":memory:");
    runMigrations(db);

    const result = await importMarketData({
      db,
      providerName: "alpaca",
      provider: fakeProvider([
        ...minuteBars({
          ticker: "SOXL",
          start: "2024-01-02T14:30:00.000Z",
          count: 240,
          baseOpen: 100
        }),
        ...minuteBars({
          ticker: "SOXS",
          start: "2024-01-02T14:30:00.000Z",
          count: 120,
          baseOpen: 200
        })
      ]),
      request: {
        tickers: ["SOXL", "SOXS"],
        startDate: "2024-01-02",
        endDate: "2024-01-02",
        baseTimeframe: "1Min"
      }
    });

    expect(result.aggregatedBarsInserted).toBe(4);
    expect(result.alignedTimestamps).toEqual([]);
    expect(result.warnings).toEqual([
      "No aligned 4H timestamps found for requested tickers: SOXL, SOXS",
      "No aligned 1D timestamps found for requested tickers: SOXL, SOXS"
    ]);
  });

  it("removes stale aggregate rows inside the refreshed import range", async () => {
    db = new Database(":memory:");
    runMigrations(db);

    db.prepare(
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
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "SOXS",
      "2H",
      "2025-11-28T18:30:00.000Z",
      3.44,
      3.47,
      3.42,
      3.45,
      100,
      120,
      "2026-04-26T14:34:45.509Z"
    );

    const result = await importMarketData({
      db,
      providerName: "alpaca",
      provider: fakeProvider(
        minuteBars({
          ticker: "SOXS",
          start: "2025-11-28T14:30:00.000Z",
          count: 240,
          baseOpen: 68
        })
      ),
      request: {
        tickers: ["SOXS"],
        startDate: "2025-11-28",
        endDate: "2025-11-28",
        baseTimeframe: "1Min"
      }
    });

    expect(result.aggregatedBarsInserted).toBe(3);

    const staleRow = db
      .prepare(
        `select close from aggregated_bars
          where ticker = ?
            and timeframe = ?
            and timestamp = ?`
      )
      .get("SOXS", "2H", "2025-11-28T18:30:00.000Z");
    expect(staleRow).toBeUndefined();

    const refreshedRow = db
      .prepare(
        `select close from aggregated_bars
          where ticker = ?
            and timeframe = ?
            and timestamp = ?`
      )
      .get("SOXS", "2H", "2025-11-28T14:30:00.000Z") as { close: number };
    expect(refreshedRow.close).toBe(188);
  });

  it("splits long imports into smaller provider requests", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const requests: Array<{ start: string; end: string }> = [];

    const provider: MarketDataProvider = {
      async getBars(request) {
        requests.push({
          start: request.start.toISOString(),
          end: request.end.toISOString()
        });
        return [];
      }
    };

    await importMarketData({
      db,
      providerName: "alpaca",
      provider,
      request: {
        tickers: ["SOXL", "SOXS"],
        startDate: "2024-01-01",
        endDate: "2024-02-10",
        baseTimeframe: "1Min"
      }
    });

    expect(requests).toEqual([
      {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-14T23:59:59.999Z"
      },
      {
        start: "2024-01-15T00:00:00.000Z",
        end: "2024-01-28T23:59:59.999Z"
      },
      {
        start: "2024-01-29T00:00:00.000Z",
        end: "2024-02-10T23:59:59.999Z"
      }
    ]);
  });

  it("marks the import run failed when the provider errors", async () => {
    db = new Database(":memory:");
    runMigrations(db);

    const provider: MarketDataProvider = {
      async getBars() {
        throw new Error("provider unavailable");
      }
    };

    await expect(
      importMarketData({
        db,
        providerName: "alpaca",
        provider,
        request: {
          tickers: ["SOXL", "SOXS"],
          startDate: "2024-01-01",
          endDate: "2024-01-02",
          baseTimeframe: "1Min"
        }
      })
    ).rejects.toThrow("provider unavailable");

    const run = db.prepare("select status, error from import_runs").get() as {
      status: string;
      error: string;
    };
    expect(run).toEqual({
      status: "failed",
      error: "provider unavailable"
    });
  });
});
