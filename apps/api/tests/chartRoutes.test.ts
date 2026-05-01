import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { runMigrations } from "../src/db/migrate.js";
import { buildServer } from "../src/server.js";
import type { MarketDataProvider } from "../src/market-data/types.js";

let db: Database.Database | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

function seedAggregatedBar({
  ticker,
  timestamp,
  close,
  timeframe = "4H"
}: {
  ticker: string;
  timestamp: string;
  close: number;
  timeframe?: "2H" | "4H" | "1D";
}): void {
  if (!db) {
    throw new Error("Database not initialized");
  }

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
    ticker,
    timeframe,
    timestamp,
    close - 1,
    close + 2,
    close - 2,
    close,
    1_000_000 + close,
    240,
    new Date().toISOString()
  );
}

function seedBars(): void {
  const startMs = new Date("2024-01-02T14:30:00.000Z").getTime();

  for (let index = 0; index < 130; index += 1) {
    const timestamp = new Date(startMs + index * 24 * 60 * 60 * 1000).toISOString();
    seedAggregatedBar({
      ticker: "SOXL",
      timestamp,
      close: 100 + index
    });
    seedAggregatedBar({
      ticker: "SOXS",
      timestamp,
      close: 200 - index * 0.4
    });
  }

  seedAggregatedBar({
    ticker: "SOXL",
    timestamp: "2025-01-01T14:30:00.000Z",
    close: 999
  });
}

function testServer() {
  const provider: MarketDataProvider = {
    async getBars() {
      return [];
    }
  };

  return buildServer({
    db,
    marketDataProvider: provider,
    marketDataProviderName: "alpaca"
  });
}

describe("chart routes", () => {
  it("returns candles and indicator snapshots for one ticker/timeframe", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    seedBars();
    const server = testServer();

    const response = await server.inject({
      method: "GET",
      url: "/chart/SOXL/4H"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      ticker: "SOXL",
      timeframe: "4H"
    });
    expect(body.candles).toHaveLength(131);
    expect(body.indicators).toHaveLength(131);
    expect(body.indicators[130]).toMatchObject({
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: "2025-01-01T14:30:00.000Z",
      ema25: expect.any(Number),
      cmWvf: expect.any(Object)
    });

    await server.close();
  });

  it("returns synchronized candles and indicators for common timestamps only", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    seedBars();
    const server = testServer();

    const response = await server.inject({
      method: "GET",
      url: "/chart/sync?timeframe=4H&tickers=SOXL,SOXS"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      timeframe: "4H",
      tickers: ["SOXL", "SOXS"]
    });
    expect(body.timestamps).toHaveLength(130);
    expect(body.series.SOXL.candles).toHaveLength(130);
    expect(body.series.SOXS.candles).toHaveLength(130);
    expect(body.series.SOXL.candles.at(-1).timestamp).toBe(
      body.series.SOXS.candles.at(-1).timestamp
    );
    expect(body.timestamps).not.toContain("2025-01-01T14:30:00.000Z");

    await server.close();
  });

  it("supports 2H and 1D chart sync requests", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    seedAggregatedBar({
      ticker: "SOXL",
      timeframe: "2H",
      timestamp: "2024-01-02T14:30:00.000Z",
      close: 100
    });
    seedAggregatedBar({
      ticker: "SOXS",
      timeframe: "2H",
      timestamp: "2024-01-02T14:30:00.000Z",
      close: 50
    });
    seedAggregatedBar({
      ticker: "SOXL",
      timeframe: "1D",
      timestamp: "2024-01-02T14:30:00.000Z",
      close: 101
    });
    seedAggregatedBar({
      ticker: "SOXS",
      timeframe: "1D",
      timestamp: "2024-01-02T14:30:00.000Z",
      close: 49
    });
    const server = testServer();

    const twoHourResponse = await server.inject({
      method: "GET",
      url: "/chart/sync?timeframe=2H&tickers=SOXL,SOXS"
    });
    const dailyResponse = await server.inject({
      method: "GET",
      url: "/chart/sync?timeframe=1D&tickers=SOXL,SOXS"
    });

    expect(twoHourResponse.statusCode).toBe(200);
    expect(twoHourResponse.json()).toMatchObject({
      timeframe: "2H",
      timestamps: ["2024-01-02T14:30:00.000Z"]
    });
    expect(dailyResponse.statusCode).toBe(200);
    expect(dailyResponse.json()).toMatchObject({
      timeframe: "1D",
      timestamps: ["2024-01-02T14:30:00.000Z"]
    });

    await server.close();
  });

  it("returns data-quality warnings for large ticker/timeframe discontinuities", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    seedAggregatedBar({
      ticker: "SOXL",
      timeframe: "2H",
      timestamp: "2024-03-01T14:30:00.000Z",
      close: 40
    });
    seedAggregatedBar({
      ticker: "SOXL",
      timeframe: "2H",
      timestamp: "2024-03-01T16:30:00.000Z",
      close: 41
    });
    seedAggregatedBar({
      ticker: "SOXS",
      timeframe: "2H",
      timestamp: "2024-03-01T14:30:00.000Z",
      close: 30
    });
    seedAggregatedBar({
      ticker: "SOXS",
      timeframe: "2H",
      timestamp: "2024-03-01T16:30:00.000Z",
      close: 18
    });
    const server = testServer();

    const response = await server.inject({
      method: "GET",
      url: "/chart/sync?timeframe=2H&tickers=SOXL,SOXS"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      warnings: [
        {
          code: "large_price_discontinuity",
          severity: "review",
          classification: "leveraged_etf_volatility",
          ticker: "SOXS",
          timeframe: "2H",
          timestamp: "2024-03-01T16:30:00.000Z",
          previousTimestamp: "2024-03-01T14:30:00.000Z",
          closeToCloseReturnPercent: -40
        }
      ]
    });

    await server.close();
  });

  it("classifies extreme non-leveraged discontinuities as data warnings", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    seedAggregatedBar({
      ticker: "SPY",
      timeframe: "1D",
      timestamp: "2024-03-01T14:30:00.000Z",
      close: 500
    });
    seedAggregatedBar({
      ticker: "SPY",
      timeframe: "1D",
      timestamp: "2024-03-04T14:30:00.000Z",
      close: 20
    });
    const server = testServer();

    const response = await server.inject({
      method: "GET",
      url: "/chart/sync?timeframe=1D&tickers=SPY"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      warnings: [
        {
          code: "large_price_discontinuity",
          severity: "warning",
          classification: "possible_bad_source_data",
          ticker: "SPY",
          timeframe: "1D",
          timestamp: "2024-03-04T14:30:00.000Z",
          closeToCloseReturnPercent: -96
        }
      ]
    });

    await server.close();
  });

  it("returns data coverage summaries and large timestamp gaps", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    seedAggregatedBar({
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: "2024-01-02T14:30:00.000Z",
      close: 100
    });
    seedAggregatedBar({
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: "2024-01-03T14:30:00.000Z",
      close: 101
    });
    seedAggregatedBar({
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: "2025-04-28T13:30:00.000Z",
      close: 150
    });
    seedAggregatedBar({
      ticker: "SOXS",
      timeframe: "4H",
      timestamp: "2024-01-02T14:30:00.000Z",
      close: 50
    });
    const server = testServer();

    const response = await server.inject({
      method: "GET",
      url: "/chart/coverage?tickers=SOXL,SOXS&timeframes=4H"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      tickers: ["SOXL", "SOXS"],
      timeframes: ["4H"],
      summaries: [
        {
          ticker: "SOXL",
          timeframe: "4H",
          barCount: 3,
          firstTimestamp: "2024-01-02T14:30:00.000Z",
          lastTimestamp: "2025-04-28T13:30:00.000Z",
          gapCount: 1,
          largestGapDays: 481
        },
        {
          ticker: "SOXS",
          timeframe: "4H",
          barCount: 1,
          firstTimestamp: "2024-01-02T14:30:00.000Z",
          lastTimestamp: "2024-01-02T14:30:00.000Z",
          gapCount: 0,
          largestGapDays: 0
        }
      ],
      gaps: [
        {
          ticker: "SOXL",
          timeframe: "4H",
          previousTimestamp: "2024-01-03T14:30:00.000Z",
          timestamp: "2025-04-28T13:30:00.000Z",
          gapDays: 481
        }
      ]
    });

    await server.close();
  });

  it("returns 400 for unsupported timeframes", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const server = testServer();

    const response = await server.inject({
      method: "GET",
      url: "/chart/SOXL/30M"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Invalid chart request"
    });

    await server.close();
  });
});
