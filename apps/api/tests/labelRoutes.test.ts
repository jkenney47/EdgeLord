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

function seedSession(id = "session-1"): string {
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
  ).run(id, "Replay", now, now, now);

  return id;
}

function labelPayload(sessionId: string) {
  return {
    sessionId,
    timestamp: "2024-01-02T14:30:00.000Z",
    ticker: "SOXL",
    timeframe: "4H",
    labelType: "ENTRY",
    price: 42.5,
    confidence: 4,
    setupQuality: 5,
    reasonCodes: ["trendline_break"],
    notes: "Breakout",
    targetPrice: 48,
    invalidationPrice: 40,
    indicatorSnapshot: {},
    structureSnapshot: {},
    drawingContext: {}
  };
}

function seedAggregatedBar({
  timestamp,
  high,
  low,
  close
}: {
  timestamp: string;
  high: number;
  low: number;
  close: number;
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
  ).run("SOXL", "4H", timestamp, close - 1, high, low, close, 1_000_000, 240, new Date().toISOString());
}

describe("label routes", () => {
  it("creates, updates, lists, and deletes trade events", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const sessionId = seedSession();
    const server = serverWithDb();

    const createResponse = await server.inject({
      method: "POST",
      url: "/labels",
      payload: labelPayload(sessionId)
    });

    expect(createResponse.statusCode).toBe(200);
    const created = createResponse.json();
    expect(created).toMatchObject({
      id: expect.any(String),
      sessionId,
      labelType: "ENTRY"
    });

    const updateResponse = await server.inject({
      method: "PATCH",
      url: `/labels/${created.id}`,
      payload: {
        confidence: 5,
        notes: "Updated"
      }
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      id: created.id,
      confidence: 5,
      notes: "Updated"
    });

    const listResponse = await server.inject({
      method: "GET",
      url: `/labels?sessionId=${sessionId}`
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toHaveLength(1);
    expect(listResponse.json()[0]).toMatchObject({
      id: created.id,
      sessionId,
      labelType: "ENTRY",
      deletedAt: null
    });

    const secondSessionId = seedSession("session-2");
    const secondCreateResponse = await server.inject({
      method: "POST",
      url: "/labels",
      payload: labelPayload(secondSessionId)
    });
    const secondCreated = secondCreateResponse.json();

    const allLabelsResponse = await server.inject({
      method: "GET",
      url: "/labels"
    });

    expect(allLabelsResponse.statusCode).toBe(200);
    expect(allLabelsResponse.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.id, sessionId }),
        expect.objectContaining({ id: secondCreated.id, sessionId: secondSessionId })
      ])
    );

    const deleteResponse = await server.inject({
      method: "DELETE",
      url: `/labels/${created.id}`
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json()).toMatchObject({
      id: created.id,
      deletedAt: expect.any(String)
    });

    await server.close();
  });

  it("returns 400 for invalid create payloads", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const server = serverWithDb();

    const response = await server.inject({
      method: "POST",
      url: "/labels",
      payload: {
        labelType: "BAD"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Invalid label request"
    });

    await server.close();
  });

  it("calculates outcomes for a label", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const sessionId = seedSession();
    seedAggregatedBar({
      timestamp: "2024-01-02T18:30:00.000Z",
      high: 45,
      low: 41,
      close: 44
    });
    seedAggregatedBar({
      timestamp: "2024-01-02T22:30:00.000Z",
      high: 49,
      low: 43,
      close: 48
    });
    const server = serverWithDb();
    const createResponse = await server.inject({
      method: "POST",
      url: "/labels",
      payload: labelPayload(sessionId)
    });
    const created = createResponse.json();

    const response = await server.inject({
      method: "POST",
      url: `/labels/${created.id}/outcome`,
      payload: { horizonBars: 2 }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: created.id,
      outcomeAvailable: true,
      outcomeHorizonBars: 2,
      outcomeStatus: "computed",
      outcomeRuleVersion: "outcome_rule_v1",
      outcomeFutureReturn1: expect.any(Number),
      outcomeFutureReturn3: null,
      outcomeFutureHitTarget: true,
      outcomeFutureHitStop: false,
      outcomeFutureBarsToTarget: 2,
      outcomeFutureBarsToStop: null
    });

    await server.close();
  });
});
