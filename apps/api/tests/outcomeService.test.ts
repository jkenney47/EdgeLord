import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { runMigrations } from "../src/db/migrate.js";
import { createTradeEvent } from "../src/labels/labelService.js";
import { calculateOutcomeForLabel } from "../src/outcomes/outcomeService.js";

let db: Database.Database | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

function createSession(): string {
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

function seedAggregatedBar({
  timestamp,
  open,
  high,
  low,
  close,
  ticker = "SOXL",
  timeframe = "4H"
}: {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  ticker?: string;
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
  ).run(ticker, timeframe, timestamp, open, high, low, close, 1_000_000, 240, new Date().toISOString());
}

function seedFutureBars(): void {
  const bars = [
    ["2024-01-02T18:30:00.000Z", 100, 104, 98, 102],
    ["2024-01-02T22:30:00.000Z", 102, 107, 101, 106],
    ["2024-01-03T02:30:00.000Z", 106, 111, 103, 110],
    ["2024-01-03T06:30:00.000Z", 110, 113, 108, 112],
    ["2024-01-03T10:30:00.000Z", 112, 116, 109, 115]
  ] as const;

  for (const [timestamp, open, high, low, close] of bars) {
    seedAggregatedBar({ timestamp, open, high, low, close });
  }
}

function baseLabel(sessionId: string, overrides: Partial<Parameters<typeof createTradeEvent>[1]> = {}) {
  return createTradeEvent(db as Database.Database, {
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
    tradeDirection: "long_ticker",
    targetPrice: 110,
    invalidationPrice: 97,
    indicatorSnapshot: {},
    structureSnapshot: {},
    drawingContext: {},
    ...overrides
  });
}

describe("outcome service", () => {
  it("calculates long label outcomes from future candles", () => {
    db = new Database(":memory:");
    runMigrations(db);
    const sessionId = createSession();
    const label = baseLabel(sessionId);
    seedFutureBars();

    const updated = calculateOutcomeForLabel(db, label.id, { horizonBars: 5 });

    expect(updated).toMatchObject({
      id: label.id,
      outcomeAvailable: true,
      outcomeHorizonBars: 5,
      outcomeStatus: "computed",
      outcomeRuleVersion: "outcome_rule_v1",
      outcomeFutureReturn1: 2,
      outcomeFutureReturn3: 10,
      outcomeFutureReturn5: 15,
      outcomeFutureReturn10: null,
      outcomeFutureMaxFavorableExcursion: 16,
      outcomeFutureMaxAdverseExcursion: -2,
      outcomeFutureHitTarget: true,
      outcomeFutureHitStop: false,
      outcomeFutureBarsToTarget: 3,
      outcomeFutureBarsToStop: null
    });
  });

  it("calculates short label outcomes in trade direction", () => {
    db = new Database(":memory:");
    runMigrations(db);
    const sessionId = createSession();
    const label = baseLabel(sessionId, {
      tradeDirection: "short_ticker",
      targetPrice: 90,
      invalidationPrice: 105
    });
    seedAggregatedBar({
      timestamp: "2024-01-02T18:30:00.000Z",
      open: 100,
      high: 102,
      low: 96,
      close: 97
    });
    seedAggregatedBar({
      timestamp: "2024-01-02T22:30:00.000Z",
      open: 97,
      high: 99,
      low: 89,
      close: 91
    });

    const updated = calculateOutcomeForLabel(db, label.id, { horizonBars: 2 });

    expect(updated).toMatchObject({
      outcomeAvailable: true,
      outcomeHorizonBars: 2,
      outcomeStatus: "computed",
      outcomeRuleVersion: "outcome_rule_v1",
      outcomeFutureReturn1: 3,
      outcomeFutureReturn3: null,
      outcomeFutureMaxFavorableExcursion: 11,
      outcomeFutureMaxAdverseExcursion: -2,
      outcomeFutureHitTarget: true,
      outcomeFutureHitStop: false,
      outcomeFutureBarsToTarget: 2,
      outcomeFutureBarsToStop: null
    });
  });

  it("marks outcomes unavailable when no future candles exist", () => {
    db = new Database(":memory:");
    runMigrations(db);
    const sessionId = createSession();
    const label = baseLabel(sessionId);

    const updated = calculateOutcomeForLabel(db, label.id, { horizonBars: 5 });

    expect(updated).toMatchObject({
      outcomeAvailable: false,
      outcomeHorizonBars: null,
      outcomeStatus: "insufficient_future_bars",
      outcomeRuleVersion: "outcome_rule_v1",
      outcomeFutureReturn1: null,
      outcomeFutureMaxFavorableExcursion: null,
      outcomeFutureMaxAdverseExcursion: null,
      outcomeFutureHitTarget: false,
      outcomeFutureHitStop: false,
      outcomeFutureBarsToTarget: null,
      outcomeFutureBarsToStop: null
    });
  });
});
