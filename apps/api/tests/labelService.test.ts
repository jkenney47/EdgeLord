import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { runMigrations } from "../src/db/migrate.js";
import {
  createTradeEvent,
  deleteTradeEvent,
  updateTradeEvent
} from "../src/labels/labelService.js";

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

describe("label service", () => {
  it("creates, updates, and deletes trade events with audit rows", () => {
    db = new Database(":memory:");
    runMigrations(db);
    const sessionId = createSession();

    const created = createTradeEvent(db, {
      sessionId,
      timestamp: "2024-01-02T14:30:00.000Z",
      ticker: "SOXL",
      timeframe: "4H",
      labelType: "ENTRY",
      price: 42.5,
      confidence: 4,
      setupQuality: 5,
      reasonCodes: ["trendline_break", "ema_alignment"],
      notes: "Clean break",
      indicatorSnapshot: { ema25: 40 },
      structureSnapshot: { recentHigh: 43 },
      drawingContext: { nearestTrendlineDistance: 0.25 }
    });

    expect(created).toMatchObject({
      id: expect.any(String),
      sessionId,
      labelType: "ENTRY",
      decisionPhase: "at_close",
      captureMode: "regular",
      labelSource: "retrospective_hindsight",
      trainingEligible: false,
      visibleUntilTimestamp: "2024-01-02T14:30:00.000Z",
      potentialVisualLeakage: false,
      selectedBarIndex: null,
      setupId: null,
      tradeId: null,
      parentLabelId: null,
      decisionRole: "entry",
      bias: "unclear",
      marketBias: "unclear",
      tradeDirection: "observe_only",
      instrumentRole: "primary",
      pairedTickerRole: "ignored",
      entryStyle: null,
      exitStyle: null,
      invalidationPrice: null,
      targetPrice: null,
      outcomeAvailable: false,
      outcomeHorizonBars: null,
      outcomeFutureReturn1: null,
      outcomeFutureReturn3: null,
      outcomeFutureReturn5: null,
      outcomeFutureReturn10: null,
      outcomeFutureMaxFavorableExcursion: null,
      outcomeFutureMaxAdverseExcursion: null,
      outcomeFutureHitTarget: null,
      outcomeFutureHitStop: null,
      outcomeFutureBarsToTarget: null,
      outcomeFutureBarsToStop: null,
      outcomeStatus: "not_computed",
      outcomeRuleVersion: null,
      multiTimeframeContext: {},
      confidence: 4,
      reasonCodes: ["trendline_break", "ema_alignment"],
      deletedAt: null
    });

    const updated = updateTradeEvent(db, created.id, {
      confidence: 5,
      notes: "Cleaner than first pass"
    });

    expect(updated).toMatchObject({
      id: created.id,
      confidence: 5,
      decisionPhase: "at_close",
      captureMode: "regular",
      labelSource: "retrospective_hindsight",
      trainingEligible: false,
      decisionRole: "entry",
      bias: "unclear",
      multiTimeframeContext: {},
      notes: "Cleaner than first pass"
    });

    const relinked = updateTradeEvent(db, created.id, {
      outcomeAvailable: true,
      outcomeHorizonBars: 10,
      outcomeFutureReturn1: 1.25,
      outcomeFutureReturn3: 3.5,
      outcomeFutureReturn5: 4.75,
      outcomeFutureReturn10: 6.25,
      outcomeFutureMaxFavorableExcursion: 8.5,
      outcomeFutureMaxAdverseExcursion: -2.25,
      outcomeFutureHitTarget: true,
      outcomeFutureHitStop: false,
      outcomeFutureBarsToTarget: 4,
      outcomeFutureBarsToStop: null,
      outcomeStatus: "computed",
      outcomeRuleVersion: "outcome_rule_v1",
      multiTimeframeContext: {
        d1: {
          timeframe: "1D",
          timestamp: "2024-01-01T21:00:00.000Z",
          contextAgeMinutes: 1050,
          candle: { close: 41 },
          indicator: { ema25: 39 },
          structureSnapshot: { recentHigh: 44 }
        }
      }
    });

    expect(relinked.multiTimeframeContext).toMatchObject({
      d1: {
        timestamp: "2024-01-01T21:00:00.000Z",
        contextAgeMinutes: 1050,
        candle: { close: 41 },
        indicator: { ema25: 39 }
      }
    });
    expect(relinked).toMatchObject({
      outcomeAvailable: true,
      outcomeHorizonBars: 10,
      outcomeFutureReturn1: 1.25,
      outcomeFutureReturn3: 3.5,
      outcomeFutureReturn5: 4.75,
      outcomeFutureReturn10: 6.25,
      outcomeFutureMaxFavorableExcursion: 8.5,
      outcomeFutureMaxAdverseExcursion: -2.25,
      outcomeFutureHitTarget: true,
      outcomeFutureHitStop: false,
      outcomeFutureBarsToTarget: 4,
      outcomeFutureBarsToStop: null,
      outcomeStatus: "computed",
      outcomeRuleVersion: "outcome_rule_v1"
    });

    const deleted = deleteTradeEvent(db, created.id);
    expect(deleted).toMatchObject({
      id: created.id,
      deletedAt: expect.any(String)
    });

    const auditRows = db
      .prepare("select action from audit_log where entity_type = 'trade_event' order by id")
      .all() as Array<{ action: string }>;
    expect(auditRows.map((row) => row.action)).toEqual(["create", "update", "update", "delete"]);
  });

  it("rejects invalid labels and unknown sessions", () => {
    db = new Database(":memory:");
    runMigrations(db);

    expect(() =>
      createTradeEvent(db as Database.Database, {
        sessionId: "missing",
        timestamp: "2024-01-02T14:30:00.000Z",
        ticker: "SOXL",
        timeframe: "4H",
        labelType: "ENTRY",
        price: 42.5,
        confidence: 4,
        setupQuality: 5,
        reasonCodes: ["trendline_break"],
        notes: null,
        indicatorSnapshot: {},
        structureSnapshot: {},
        drawingContext: {}
      })
    ).toThrow("Session not found");

    const sessionId = createSession();
    const invalidPayload = {
        sessionId,
        timestamp: "2024-01-02T14:30:00.000Z",
        ticker: "SOXL",
        timeframe: "4H",
        labelType: "BAD",
        price: 42.5,
        confidence: 6,
        setupQuality: 5,
        reasonCodes: ["not_real"],
        notes: null,
        indicatorSnapshot: {},
        structureSnapshot: {},
        drawingContext: {}
      } as unknown as Parameters<typeof createTradeEvent>[1];

    expect(() => createTradeEvent(db as Database.Database, invalidPayload)).toThrow(
      "Invalid trade event"
    );
  });
});
