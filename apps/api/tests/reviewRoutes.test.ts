import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { runMigrations } from "../src/db/migrate.js";
import { createTradeEvent } from "../src/labels/labelService.js";
import { buildServer } from "../src/server.js";
import type { MarketDataProvider } from "../src/market-data/types.js";

let db: Database.Database | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

function serverWithDb() {
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

function seedSession(): string {
  if (!db) {
    throw new Error("Database not initialized");
  }

  const now = new Date().toISOString();
  db.prepare(
    `insert into sessions (
      id,
      name,
      start_time,
      created_at,
      updated_at
    ) values (?, ?, ?, ?, ?)`
  ).run("session-1", "Replay", now, now, now);

  return "session-1";
}

describe("review routes", () => {
  it("summarizes labels, inferred pairs, distributions, and conditions", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const sessionId = seedSession();
    createTradeEvent(db, {
      sessionId,
      timestamp: "2024-01-02T14:30:00.000Z",
      ticker: "SOXL",
      timeframe: "4H",
      labelType: "ENTRY",
      price: 100,
      confidence: 4,
      setupQuality: 5,
      reasonCodes: ["trendline_break"],
      notes: null,
      indicatorSnapshot: {
        ema25: 95,
        atr14Rma: 3.2,
        smio: { oscillator: 0.25 },
        stochRsi: { k: 72, d: 65 }
      },
      structureSnapshot: {},
      drawingContext: {
        nearestTrendline: { id: "trendline-1", distance: 1 },
        nearestLevel: { id: "level-1", distance: -1.5 },
        breakoutMarker: { id: "marker-1" }
      }
    });
    createTradeEvent(db, {
      sessionId,
      timestamp: "2024-01-03T14:30:00.000Z",
      ticker: "SOXL",
      timeframe: "4H",
      labelType: "EXIT",
      price: 110,
      confidence: 3,
      setupQuality: 3,
      reasonCodes: [],
      notes: null,
      indicatorSnapshot: {},
      structureSnapshot: {},
      drawingContext: {}
    });
    createTradeEvent(db, {
      sessionId,
      timestamp: "2024-01-04T14:30:00.000Z",
      ticker: "SOXL",
      timeframe: "4H",
      labelType: "SKIP",
      price: 108,
      confidence: 2,
      setupQuality: 2,
      reasonCodes: ["ema_alignment"],
      notes: null,
      indicatorSnapshot: {
        ema25: 104,
        atr14Rma: 2.1,
        smio: { oscillator: -0.2 },
        stochRsi: { k: 31, d: 35 }
      },
      structureSnapshot: {},
      drawingContext: {}
    });
    const server = serverWithDb();

    const response = await server.inject({
      method: "GET",
      url: `/review/summary?sessionId=${sessionId}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      totalLabels: 3,
      counts: {
        ENTRY: 1,
        EXIT: 1,
        SKIP: 1,
        INVALID: 0
      },
      confidenceDistribution: {
        "2": 1,
        "3": 1,
        "4": 1
      },
      pairedTrades: {
        count: 1,
        wins: 1,
        losses: 0,
        winRate: 1,
        averageReturnPercent: 10
      },
      conditionSummary: {
        entryReasonCodes: {
          trendline_break: 1
        },
        profitableReasonCodes: {
          trendline_break: 1
        },
        losingReasonCodes: {},
        skippedReasonCodes: {
          ema_alignment: 1
        },
        entriesWithBreakoutMarker: 1,
        entriesNearTrendline: 1,
        entriesNearLevel: 1
      },
      indicatorAverages: {
        entries: {
          count: 1,
          smioOscillator: 0.25,
          stochK: 72,
          stochD: 65,
          atr14Rma: 3.2,
          ema25DistancePercent: 5
        },
        profitableEntries: {
          count: 1,
          smioOscillator: 0.25
        },
        skipped: {
          count: 1,
          smioOscillator: -0.2,
          stochK: 31,
          stochD: 35,
          atr14Rma: 2.1,
          ema25DistancePercent: 3.7037
        }
      },
      lossClusters: {
        reasonCodes: {},
        worstPairs: []
      }
    });

    await server.close();
  });
});
