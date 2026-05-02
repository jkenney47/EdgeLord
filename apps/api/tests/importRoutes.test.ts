import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { buildServer } from "../src/server.js";
import { runMigrations } from "../src/db/migrate.js";
import type { BaseBar, MarketDataProvider } from "../src/market-data/types.js";

let db: Database.Database | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

function minuteBars(ticker: string, start: string, count: number): BaseBar[] {
  const startMs = new Date(start).getTime();

  return Array.from({ length: count }, (_, index) => ({
    ticker,
    timestamp: new Date(startMs + index * 60_000).toISOString(),
    open: 100 + index,
    high: 101 + index,
    low: 99 + index,
    close: 100.5 + index,
    volume: 1000 + index
  }));
}

describe("import routes", () => {
  it("imports SOXL/SOXS with default tickers and base timeframe", async () => {
    db = new Database(":memory:");
    runMigrations(db);

    const provider: MarketDataProvider = {
      async getBars() {
        return [
          ...minuteBars("SOXL", "2024-01-02T14:30:00.000Z", 240),
          ...minuteBars("SOXS", "2024-01-02T14:30:00.000Z", 240)
        ];
      }
    };
    const server = buildServer({
      db,
      marketDataProvider: provider,
      marketDataProviderName: "alpaca"
    });

    const response = await server.inject({
      method: "POST",
      url: "/import",
      payload: {
        startDate: "2024-01-02",
        endDate: "2024-01-02"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      provider: "alpaca",
      tickers: ["SOXL", "SOXS"],
      baseBarsInserted: 480,
      aggregatedBarsInserted: 6,
      alignedTimestamps: ["2024-01-02T14:30:00.000Z"],
      warnings: ["No aligned 1D timestamps found for requested tickers: SOXL, SOXS"]
    });

    await server.close();
  });

  it("returns 400 for unsupported base timeframes", async () => {
    db = new Database(":memory:");
    runMigrations(db);

    const provider: MarketDataProvider = {
      async getBars() {
        return [];
      }
    };
    const server = buildServer({
      db,
      marketDataProvider: provider,
      marketDataProviderName: "alpaca"
    });

    const response = await server.inject({
      method: "POST",
      url: "/import",
      payload: {
        baseTimeframe: "15Min"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Invalid import request"
    });

    await server.close();
  });

  it("accepts an import chunk delay for rate-limited backfills", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const provider: MarketDataProvider = {
      async getBars() {
        return [];
      }
    };
    const server = buildServer({
      db,
      marketDataProvider: provider,
      marketDataProviderName: "alpaca"
    });

    const response = await server.inject({
      method: "POST",
      url: "/import",
      payload: {
        startDate: "2024-01-01",
        endDate: "2024-01-01",
        chunkDelayMs: 750
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      provider: "alpaca"
    });

    await server.close();
  });

  it("returns a clean import error when the provider fails", async () => {
    db = new Database(":memory:");
    runMigrations(db);

    const provider: MarketDataProvider = {
      async getBars() {
        throw new Error("Alpaca credentials are not configured");
      }
    };
    const server = buildServer({
      db,
      marketDataProvider: provider,
      marketDataProviderName: "alpaca"
    });

    const response = await server.inject({
      method: "POST",
      url: "/import",
      payload: {}
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toMatchObject({
      error: "Import failed",
      message: "Alpaca credentials are not configured"
    });

    await server.close();
  });
});
