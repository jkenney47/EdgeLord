import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { runMigrations } from "../src/db/migrate.js";
import { createTradeEvent, deleteTradeEvent } from "../src/labels/labelService.js";
import { buildServer } from "../src/server.js";
import { exportVersions } from "../src/export/exportVersions.js";
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

function seedSession(id: string): string {
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

function seedAggregatedBar({
  ticker,
  timeframe,
  timestamp,
  close
}: {
  ticker: string;
  timeframe: "2H" | "4H" | "1D";
  timestamp: string;
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
  ).run(
    ticker,
    timeframe,
    timestamp,
    close - 1,
    close + 2,
    close - 2,
    close,
    1_000_000,
    timeframe === "1D" ? 390 : timeframe === "4H" ? 240 : 120,
    new Date().toISOString()
  );
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

describe("export routes", () => {
  it("exports active trade events as JSON and flattened CSV", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const sessionId = seedSession("session-1");
    const deletedSessionId = seedSession("session-2");
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
      notes: "Breakout, clean",
      decisionPhase: "at_close",
      captureMode: "replay",
      labelSource: "retrospective_replay",
      trainingEligible: true,
      visibleUntilTimestamp: "2024-01-02T14:30:00.000Z",
      potentialVisualLeakage: false,
      selectedBarIndex: 12,
      setupId: "setup-1",
      tradeId: "trade-1",
      parentLabelId: null,
      decisionRole: "trigger",
      bias: "long",
      marketBias: "bullish_semis",
      tradeDirection: "long_ticker",
      instrumentRole: "primary",
      pairedTickerRole: "confirmation",
      entryStyle: "breakout",
      exitStyle: null,
      invalidationPrice: 39.75,
      targetPrice: 48.5,
      outcomeAvailable: true,
      outcomeHorizonBars: 10,
      outcomeFutureReturn1: 1.1,
      outcomeFutureReturn3: 2.2,
      outcomeFutureReturn5: 3.3,
      outcomeFutureReturn10: 4.4,
      outcomeFutureMaxFavorableExcursion: 5.5,
      outcomeFutureMaxAdverseExcursion: -1.2,
      outcomeFutureHitTarget: true,
      outcomeFutureHitStop: false,
      outcomeFutureBarsToTarget: 7,
      outcomeFutureBarsToStop: null,
      multiTimeframeContext: {
        d1: {
          timeframe: "1D",
          timestamp: "2024-01-01T21:00:00.000Z",
          contextAgeMinutes: 1050,
          candle: { close: 41.25 },
          indicator: {
            ema25: 39.5,
            sma100: 35.5,
            monthlyVwap: 38,
            atr14Rma: 2.75,
            smio: { oscillator: 0.31 },
            stochRsi: { k: 64, d: 58 },
            cmWvf: { plot: -3.1 }
          },
          structureSnapshot: {
            recentHigh: 44,
            recentLow: 37,
            distanceToRecentHigh: 2.75,
            distanceToRecentLow: 4.25
          }
        },
        h4: {
          timeframe: "4H",
          timestamp: "2024-01-02T14:30:00.000Z",
          contextAgeMinutes: 0,
          candle: { close: 42.5 },
          indicator: {
            ema25: 40,
            sma100: 35,
            monthlyVwap: 37.5,
            atr14Rma: 2.25,
            smio: { oscillator: 0.42 },
            stochRsi: { k: 70, d: 65 },
            cmWvf: { plot: -2.5 }
          },
          structureSnapshot: {
            recentHigh: 43,
            recentLow: 39,
            distanceToRecentHigh: 0.5,
            distanceToRecentLow: 3.5
          }
        },
        h2: {
          timeframe: "2H",
          timestamp: "2024-01-02T12:30:00.000Z",
          contextAgeMinutes: 120,
          candle: { close: 42.1 },
          indicator: {
            ema25: 39.8,
            sma100: 35.2,
            monthlyVwap: 37.2,
            atr14Rma: 2.1,
            smio: { oscillator: 0.38 },
            stochRsi: { k: 68, d: 63 },
            cmWvf: { plot: -2.2 }
          },
          structureSnapshot: {
            recentHigh: 42.8,
            recentLow: 39.3,
            distanceToRecentHigh: 0.7,
            distanceToRecentLow: 2.8
          }
        }
      },
      indicatorSnapshot: {
        ticker: "SOXL",
        timeframe: "4H",
        timestamp: "2024-01-02T14:30:00.000Z",
        volume: 1000,
        volumeSma20: 900,
        ema25: 40,
        sma100: 35,
        monthlyVwap: 37.5,
        atr14Rma: 2.25,
        smio: { erg: 0.75, signal: 0.33, oscillator: 0.42 },
        stochRsi: { rsi: 61, stoch: 75, k: 70, d: 65 },
        cmWvf: {
          wvf: 2.5,
          plot: -2.5,
          upperBand: 3,
          rangeHigh: 2.75,
          filtered: true,
          filteredAggressive: false,
          alert1: false,
          alert2: true,
          alert3: true,
          alert4: false
        },
        pairedTicker: {
          ticker: "SOXS",
          candle: {
            timestamp: "2024-01-02T14:30:00.000Z",
            open: 12,
            high: 13,
            low: 11.5,
            close: 12.25,
            volume: 2500
          },
          indicator: {
            volumeSma20: 2000,
            ema25: 13,
            sma100: 15,
            monthlyVwap: 14,
            atr14Rma: 0.8,
            smio: { oscillator: -0.12 },
            stochRsi: { k: 25, d: 30 },
            cmWvf: { plot: -7.2, filtered: false, filteredAggressive: true }
          },
          structureSnapshot: {
            recentCandles: [
              {
                timestamp: "2024-01-01T14:30:00.000Z",
                open: 13.5,
                high: 14,
                low: 12.75,
                close: 13,
                volume: 2400
              },
              {
                timestamp: "2024-01-02T14:30:00.000Z",
                open: 12,
                high: 13,
                low: 11.5,
                close: 12.25,
                volume: 2500
              }
            ],
            recentHigh: 14,
            recentLow: 11.5,
            distanceToRecentHigh: 1.75,
            distanceToRecentLow: 0.75
          }
        }
      },
      structureSnapshot: {
        recentCandles: [
          {
            timestamp: "2024-01-01T14:30:00.000Z",
            open: 39.5,
            high: 41,
            low: 39,
            close: 40,
            volume: 900
          },
          {
            timestamp: "2024-01-02T14:30:00.000Z",
            open: 41,
            high: 43,
            low: 40,
            close: 42.5,
            volume: 1000
          }
        ],
        recentHigh: 43,
        recentLow: 39,
        distanceToRecentHigh: 0.5,
        distanceToRecentLow: 3.5
      },
      drawingContext: {
        nearestTrendline: {
          id: "trendline-1",
          priceAtTimestamp: 42.25,
          slope: 0.05,
          distance: 0.25
        },
        nearestLevel: { id: "level-1", price: 41, distance: 1.5 },
        breakoutMarker: { id: "marker-1" }
      }
    });
    const deleted = createTradeEvent(db, {
      sessionId: deletedSessionId,
      timestamp: "2024-01-03T14:30:00.000Z",
      ticker: "SOXS",
      timeframe: "4H",
      labelType: "SKIP",
      price: 12,
      confidence: 2,
      setupQuality: 2,
      reasonCodes: [],
      notes: null,
      indicatorSnapshot: {},
      structureSnapshot: {},
      drawingContext: {}
    });
    deleteTradeEvent(db, deleted.id);
    const server = serverWithDb();

    const jsonResponse = await server.inject({
      method: "GET",
      url: `/export/trade-events?format=json&sessionId=${sessionId}`
    });

    expect(jsonResponse.statusCode).toBe(200);
    expect(jsonResponse.headers["content-disposition"]).toContain("edgelord-trade-events.json");
    expect(jsonResponse.json()).toMatchObject({
      manifest: {
        ...exportVersions,
        format: "json",
        decisionFeatureExport: {
          outcomeFieldsIncluded: false
        },
        outcomeFields: {
          classification: "evaluation_only",
          jsonIncluded: true,
          csvIncluded: false,
          ruleVersion: "outcome_rule_v1"
        },
        filters: { sessionId },
        qa: {
          status: "warning",
          blockers: 0,
          warnings: 3
        },
        includedLabelTypes: { ENTRY: 1 },
        rowCount: 1,
        exportedAt: expect.any(String)
      },
      events: expect.any(Array)
    });
    expect(jsonResponse.json().events).toHaveLength(1);
    expect(jsonResponse.json().events[0]).toMatchObject({
      id: created.id,
      sessionId,
      decisionPhase: "at_close",
      captureMode: "replay",
      visibleUntilTimestamp: "2024-01-02T14:30:00.000Z",
      potentialVisualLeakage: false,
      selectedBarIndex: 12,
      setupId: "setup-1",
      tradeId: "trade-1",
      decisionRole: "trigger",
      bias: "long",
      marketBias: "bullish_semis",
      tradeDirection: "long_ticker",
      outcomeAvailable: true,
      outcomeHorizonBars: 10,
      outcomeFutureReturn1: 1.1,
      outcomeFutureMaxFavorableExcursion: 5.5,
      outcomeFutureMaxAdverseExcursion: -1.2,
      outcomeFutureHitTarget: true,
      outcomeFutureHitStop: false,
      outcomeFutureBarsToTarget: 7,
      multiTimeframeContext: {
        d1: {
          timestamp: "2024-01-01T21:00:00.000Z",
          contextAgeMinutes: 1050
        },
        h4: {
          timestamp: "2024-01-02T14:30:00.000Z",
          contextAgeMinutes: 0
        },
        h2: {
          timestamp: "2024-01-02T12:30:00.000Z",
          contextAgeMinutes: 120
        }
      },
      drawingContext: {
        nearestTrendline: { id: "trendline-1", distance: 0.25 }
      }
    });

    const csvResponse = await server.inject({
      method: "GET",
      url: `/export/trade-events?format=csv&sessionId=${sessionId}`
    });

    expect(csvResponse.statusCode).toBe(200);
    expect(csvResponse.headers["content-type"]).toContain("text/csv");
    const [csvHeader, csvRow] = csvResponse.body.split("\n");
    const csvRecord = Object.fromEntries(
      csvHeader.split(",").map((column, index) => [column, parseCsvLine(csvRow)[index]])
    );
    expect(csvHeader.startsWith("schemaVersion,exportVersion,indicatorCalcVersion,structureCalcVersion")).toBe(
      true
    );
    expect(csvRow).toContain(
      `${exportVersions.schemaVersion},${exportVersions.exportVersion},${exportVersions.indicatorCalcVersion},${exportVersions.structureCalcVersion}`
    );
    expect(csvHeader).toContain("nearestTrendlineDistance");
    expect(csvHeader).toContain("decisionPhase");
    expect(csvHeader).toContain("labelSource");
    expect(csvHeader).toContain("trainingEligible");
    expect(csvHeader).toContain("visibleUntilTimestamp");
    expect(csvHeader).toContain("potentialVisualLeakage");
    expect(csvHeader).toContain("setupId");
    expect(csvHeader).toContain("tradeDirection");
    expect(csvHeader).toContain("d1Timestamp");
    expect(csvHeader).toContain("h4Close");
    expect(csvHeader).toContain("h2ContextAgeMinutes");
    expect(csvHeader).toContain("decisionBarRange");
    expect(csvHeader).toContain("decisionCloseAboveEma25");
    expect(csvHeader).toContain("decisionCmWvfSignalState");
    expect(csvHeader).toContain("pairedContextMissing");
    expect(csvHeader).toContain("pairRatioClose");
    expect(csvHeader).toContain("pairDivergenceFlag");
    expect(csvHeader).not.toContain("outcomeFutureReturn1");
    expect(csvHeader).not.toContain("outcomeFutureMaxFavorableExcursion");
    expect(csvRow).toContain("at_close,replay,retrospective_replay,true,2024-01-02T14:30:00.000Z,false,12");
    expect(csvRow).toContain("setup-1,trade-1,,trigger,long,bullish_semis,long_ticker,primary,confirmation,breakout,,39.75,48.5");
    expect(csvRow).toContain("2024-01-01T21:00:00.000Z,1050,41.25,39.5,35.5,38,0.31,64,58,-3.1,2.75,44,37,2.75,4.25");
    expect(csvRow).toContain("2024-01-02T12:30:00.000Z,120,42.1,39.8,35.2,37.2,0.38,68,63,-2.2,2.1,42.8,39.3,0.7,2.8");
    expect(csvRecord).toMatchObject({
      decisionBarRange: "3",
      decisionBarBody: "1.5",
      decisionBarUpperWick: "0.5",
      decisionBarLowerWick: "1",
      decisionBarClosePositionInRange: "0.833333",
      decisionBarReturn1Percent: "6.25",
      decisionBarGapFromPrevClosePercent: "2.5",
      decisionBarAtrNormalizedRange: "1.333333",
      decisionCloseAboveEma25: "true",
      decisionCloseAboveSma100: "true",
      decisionCloseAboveMonthlyVwap: "true",
      decisionDistanceToEma25Percent: "5.882353",
      decisionDistanceToEma25Atr: "1.111111",
      decisionAtr14RmaPctOfClose: "5.294118",
      decisionStochRsiKAboveD: "true",
      decisionStochRsiOverbought: "false",
      decisionStochRsiOversold: "false",
      decisionCmWvfSignalState: "spike",
      decisionCloseRankInRecent20Range: "0.875",
      decisionVolumeRankRecent20: "1",
      pairedContextMissing: "false",
      pairedReturn1Percent: "-5.769231",
      pairedCloseAboveEma25: "false",
      pairedCloseAboveSma100: "false",
      pairedCloseAboveMonthlyVwap: "false",
      pairedDistanceToEma25Percent: "-6.122449",
      pairedAtr14RmaPctOfClose: "6.530612",
      pairRatioClose: "3.469388",
      pairRatioReturn1Percent: "12.755113",
      pairDivergenceFlag: "false"
    });
    expect(csvHeader).toContain("pairedSmioOscillator");
    expect(csvHeader).toContain("recentCandleHighs");
    expect(csvHeader).toContain("cmWvfFilteredAggressive");
    expect(csvResponse.body).toContain(created.id);
    expect(csvResponse.body).toContain("trendline_break|ema_alignment");
    expect(csvResponse.body).toContain('"Breakout, clean"');
    expect(csvRow).toContain("0.42");
    expect(csvRow).toContain("41|43");
    expect(csvRow).toContain("39|40");
    expect(csvRow).toContain("SOXS");
    expect(csvRow).toContain("-0.12");
    expect(csvRow).toContain("trendline-1,42.25,0.05,0.25");
    expect(csvRow).toContain("level-1,41,1.5");
    expect(csvResponse.body).not.toContain(deleted.id);

    const validationResponse = await server.inject({
      method: "GET",
      url: `/export/trade-events/validation?sessionId=${sessionId}`
    });

    expect(validationResponse.statusCode).toBe(200);
    expect(validationResponse.json()).toMatchObject({
      status: "warning",
      summary: {
        totalLabels: 1,
        errorCount: 0,
        warningCount: 3,
        labelsByTicker: { SOXL: 1 },
        labelsByTimeframe: { "4H": 1 },
        labelsByLabelType: { ENTRY: 1 },
        labelsByReplayMode: { replay: 1 },
        labelsByDecisionRole: { trigger: 1 },
        labelsByBias: { long: 1 },
        labelsByTradeDirection: { long_ticker: 1 },
        labelsWithMissingPairedContext: 0,
        labelsWithLeakageWarnings: 0,
        labelsWithIncompleteIntent: 0,
        labelsWithSetupId: 1,
        labelsWithTradeId: 1,
        labelsWithOutcomeAvailable: 1,
        labelsByOutcomeStatus: { computed: 1 },
        outcomeRuleVersions: { outcome_rule_v1: 1 },
        outcomeFieldsExcludedFromDecisionCsv: true
      },
      issues: expect.arrayContaining([
        expect.objectContaining({
          severity: "warning",
          code: "drawing_reference_missing",
          labelId: created.id,
          message: expect.stringContaining("trendline-1")
        }),
        expect.objectContaining({
          severity: "warning",
          code: "drawing_reference_missing",
          labelId: created.id,
          message: expect.stringContaining("level-1")
        }),
        expect.objectContaining({
          severity: "warning",
          code: "drawing_reference_missing",
          labelId: created.id,
          message: expect.stringContaining("marker-1")
        })
      ])
    });

    await server.close();
  });

  it("returns an auditable preview manifest with validation status", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const sessionId = seedSession("session-1");
    createTradeEvent(db, {
      sessionId,
      timestamp: "2024-01-02T14:30:00.000Z",
      ticker: "SOXL",
      timeframe: "4H",
      labelType: "ENTRY",
      price: 42.5,
      confidence: 4,
      setupQuality: 5,
      reasonCodes: ["trendline_break"],
      notes: null,
      captureMode: "replay",
      visibleUntilTimestamp: "2024-01-02T14:30:00.000Z",
      potentialVisualLeakage: false,
      setupId: "setup-1",
      bias: "long",
      tradeDirection: "long_ticker",
      indicatorSnapshot: {
        pairedTicker: {
          ticker: "SOXS",
          candle: { timestamp: "2024-01-02T14:30:00.000Z", close: 11.5 }
        }
      },
      structureSnapshot: {
        recentCandles: [{ timestamp: "2024-01-02T14:30:00.000Z", close: 42.5 }]
      },
      drawingContext: {
        nearestTrendline: { id: "trendline-missing", priceAtTimestamp: 42.5 }
      },
      multiTimeframeContext: {
        d1: { timestamp: "2024-01-01T21:00:00.000Z" },
        h4: { timestamp: "2024-01-02T14:30:00.000Z" },
        h2: { timestamp: "2024-01-02T12:30:00.000Z" }
      }
    });
    const server = serverWithDb();

    const response = await server.inject({
      method: "GET",
      url: `/export/trade-events/validation?sessionId=${sessionId}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "warning",
      manifest: {
        ...exportVersions,
        format: "json",
        filters: { sessionId },
        qa: {
          status: "warning",
          blockers: 0,
          warnings: 1
        },
        includedLabelTypes: { ENTRY: 1 },
        rowCount: 1,
        exportedAt: expect.any(String),
        outcomeFields: {
          classification: "evaluation_only",
          csvIncluded: false,
          jsonIncluded: true,
          ruleVersion: "outcome_rule_v1"
        }
      }
    });

    await server.close();
  });

  it("exports replay-safe research labels separately from the full feature export", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const sessionId = seedSession("session-1");
    const replayLabel = createTradeEvent(db, {
      sessionId,
      timestamp: "2024-01-02T14:30:00.000Z",
      ticker: "SOXL",
      timeframe: "4H",
      labelType: "ENTRY",
      price: 42.5,
      confidence: 4,
      setupQuality: 5,
      reasonCodes: ["ema_alignment"],
      notes: "clean",
      captureMode: "replay",
      visibleUntilTimestamp: "2024-01-02T14:30:00.000Z",
      potentialVisualLeakage: false,
      selectedBarIndex: 12,
      setupId: "setup-1",
      tradeId: "trade-1",
      tradeDirection: "long_ticker",
      indicatorSnapshot: {},
      structureSnapshot: {},
      drawingContext: {}
    });
    const regularLabel = createTradeEvent(db, {
      sessionId,
      timestamp: "2024-01-03T14:30:00.000Z",
      ticker: "SOXS",
      timeframe: "4H",
      labelType: "SKIP",
      price: 12,
      confidence: 2,
      setupQuality: 2,
      reasonCodes: ["other"],
      notes: null,
      captureMode: "regular",
      visibleUntilTimestamp: "2024-01-03T14:30:00.000Z",
      potentialVisualLeakage: true,
      indicatorSnapshot: {},
      structureSnapshot: {},
      drawingContext: {}
    });
    const server = serverWithDb();

    const csvResponse = await server.inject({
      method: "GET",
      url: `/export/research-labels?format=csv&sessionId=${sessionId}`
    });

    expect(csvResponse.statusCode).toBe(200);
    expect(csvResponse.headers["content-disposition"]).toContain("edgelord-labels.csv");
    expect(csvResponse.headers["x-edgelord-export-manifest"]).toEqual(expect.any(String));
    expect(JSON.parse(String(csvResponse.headers["x-edgelord-export-manifest"]))).toMatchObject({
      format: "csv",
      filters: {
        sessionId,
        replaySafeOnly: true,
        trainingEligibleOnly: true
      },
      rowCount: 1,
      includedLabelTypes: { ENTRY: 1 }
    });
    const [header, row] = csvResponse.body.split("\n");
    expect(header).toBe(
      "label_id,session_id,ticker,timeframe,timestamp,bar_index,price,label_type,label_source,training_eligible,capture_mode,visible_until_timestamp,replay_safe,potential_visual_leakage,trade_id,parent_label_id,direction,confidence,setup_quality,reason_codes,notes_present,notes_length,created_at"
    );
    const record = Object.fromEntries(header.split(",").map((column, index) => [column, parseCsvLine(row)[index]]));
    expect(record).toMatchObject({
      label_id: replayLabel.id,
      ticker: "SOXL",
      label_type: "ENTRY",
      label_source: "retrospective_replay",
      training_eligible: "true",
      capture_mode: "replay",
      replay_safe: "true",
      potential_visual_leakage: "false",
      direction: "long_ticker",
      reason_codes: "ema_alignment",
      notes_present: "true",
      notes_length: "5"
    });
    expect(csvResponse.body).not.toContain(regularLabel.id);

    const jsonlResponse = await server.inject({
      method: "GET",
      url: `/export/research-labels?format=jsonl&sessionId=${sessionId}&includeFutureVisible=true`
    });

    expect(jsonlResponse.statusCode).toBe(200);
    expect(jsonlResponse.headers["content-type"]).toContain("application/x-ndjson");
    const jsonlRows = jsonlResponse.body.split("\n").map((line) => JSON.parse(line));
    expect(jsonlRows).toHaveLength(2);
    expect(jsonlRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label_id: replayLabel.id,
          replay_safe: true,
          training_eligible: true
        }),
        expect.objectContaining({
          label_id: regularLabel.id,
          label_source: "retrospective_hindsight",
          training_eligible: false,
          replay_safe: false,
          potential_visual_leakage: true
        })
      ])
    );

    await server.close();
  });

  it("exports paired trades as training-eligible CSV by default", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const sessionId = seedSession("session-1");
    const entry = createTradeEvent(db, {
      sessionId,
      timestamp: "2024-01-02T14:30:00.000Z",
      ticker: "SOXL",
      timeframe: "4H",
      labelType: "ENTRY",
      price: 40,
      confidence: 4,
      setupQuality: 5,
      reasonCodes: ["ema_alignment"],
      notes: null,
      captureMode: "replay",
      visibleUntilTimestamp: "2024-01-02T14:30:00.000Z",
      potentialVisualLeakage: false,
      setupId: "setup-1",
      tradeId: "trade-1",
      tradeDirection: "long_ticker",
      indicatorSnapshot: {},
      structureSnapshot: {},
      drawingContext: {}
    });
    const exit = createTradeEvent(db, {
      sessionId,
      timestamp: "2024-01-03T14:30:00.000Z",
      ticker: "SOXL",
      timeframe: "4H",
      labelType: "EXIT",
      price: 44,
      confidence: 3,
      setupQuality: 4,
      reasonCodes: ["other"],
      notes: null,
      captureMode: "replay",
      visibleUntilTimestamp: "2024-01-03T14:30:00.000Z",
      potentialVisualLeakage: false,
      setupId: "setup-1",
      tradeId: "trade-1",
      parentLabelId: entry.id,
      tradeDirection: "long_ticker",
      indicatorSnapshot: {},
      structureSnapshot: {},
      drawingContext: {}
    });
    const regularEntry = createTradeEvent(db, {
      sessionId,
      timestamp: "2024-01-04T14:30:00.000Z",
      ticker: "SOXS",
      timeframe: "4H",
      labelType: "ENTRY",
      price: 12,
      confidence: 3,
      setupQuality: 3,
      reasonCodes: [],
      notes: null,
      captureMode: "regular",
      potentialVisualLeakage: true,
      tradeId: "trade-2",
      indicatorSnapshot: {},
      structureSnapshot: {},
      drawingContext: {}
    });
    createTradeEvent(db, {
      sessionId,
      timestamp: "2024-01-05T14:30:00.000Z",
      ticker: "SOXS",
      timeframe: "4H",
      labelType: "EXIT",
      price: 11,
      confidence: 3,
      setupQuality: 3,
      reasonCodes: [],
      notes: null,
      captureMode: "regular",
      potentialVisualLeakage: true,
      tradeId: "trade-2",
      parentLabelId: regularEntry.id,
      indicatorSnapshot: {},
      structureSnapshot: {},
      drawingContext: {}
    });
    const server = serverWithDb();

    const response = await server.inject({
      method: "GET",
      url: `/export/paired-trades?sessionId=${sessionId}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-disposition"]).toContain("edgelord-trades.csv");
    expect(JSON.parse(String(response.headers["x-edgelord-export-manifest"]))).toMatchObject({
      format: "csv",
      filters: {
        sessionId,
        trainingEligibleOnly: true
      },
      rowCount: 1,
      unmatchedExitCount: 0,
      openTradeCount: 0
    });
    const [header, row] = response.body.split("\n");
    const record = Object.fromEntries(header.split(",").map((column, index) => [column, parseCsvLine(row)[index]]));
    expect(record).toMatchObject({
      trade_id: "trade-1",
      entry_label_id: entry.id,
      exit_label_id: exit.id,
      ticker: "SOXL",
      entry_price: "40",
      exit_price: "44",
      return_pct: "10",
      entry_label_source: "retrospective_replay",
      exit_label_source: "retrospective_replay"
    });
    expect(response.body).not.toContain("trade-2");

    await server.close();
  });

  it("exports training features without future-visible rows", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const sessionId = seedSession("session-1");
    const replayLabel = createTradeEvent(db, {
      sessionId,
      timestamp: "2024-01-02T14:30:00.000Z",
      ticker: "SOXL",
      timeframe: "4H",
      labelType: "ENTRY",
      price: 42.5,
      confidence: 4,
      setupQuality: 5,
      reasonCodes: ["ema_alignment"],
      notes: null,
      captureMode: "replay",
      visibleUntilTimestamp: "2024-01-02T14:30:00.000Z",
      potentialVisualLeakage: false,
      selectedBarIndex: 12,
      indicatorSnapshot: {
        ticker: "SOXL",
        timeframe: "4H",
        timestamp: "2024-01-02T14:30:00.000Z",
        ema25: 40,
        sma100: 35,
        monthlyVwap: 37.5,
        atr14Rma: 2.25,
        smio: { oscillator: 0.42 },
        stochRsi: { k: 70, d: 65 },
        cmWvf: { filtered: true, filteredAggressive: false }
      },
      structureSnapshot: {},
      drawingContext: {}
    });
    const regularLabel = createTradeEvent(db, {
      sessionId,
      timestamp: "2024-01-03T14:30:00.000Z",
      ticker: "SOXS",
      timeframe: "4H",
      labelType: "ENTRY",
      price: 12,
      confidence: 2,
      setupQuality: 2,
      reasonCodes: [],
      notes: null,
      captureMode: "regular",
      potentialVisualLeakage: true,
      indicatorSnapshot: {},
      structureSnapshot: {},
      drawingContext: {}
    });
    const server = serverWithDb();

    const response = await server.inject({
      method: "GET",
      url: `/export/training-features?sessionId=${sessionId}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-disposition"]).toContain("edgelord-training-features.csv");
    expect(JSON.parse(String(response.headers["x-edgelord-export-manifest"]))).toMatchObject({
      format: "csv",
      decisionFeatureExport: {
        outcomeFieldsIncluded: false
      },
      filters: {
        sessionId,
        trainingEligibleOnly: true
      },
      rowCount: 1,
      includedLabelTypes: { ENTRY: 1 }
    });
    expect(response.body).toContain(replayLabel.id);
    expect(response.body).toContain("labelSource");
    expect(response.body).toContain("trainingEligible");
    expect(response.body).toContain("retrospective_replay,true");
    expect(response.body).not.toContain(regularLabel.id);

    await server.close();
  });

  it("reports export validation errors for leakage and missing snapshots", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const sessionId = seedSession("session-1");
    const created = createTradeEvent(db, {
      sessionId,
      timestamp: "2024-01-03T14:30:00.000Z",
      ticker: "SOXL",
      timeframe: "4H",
      labelType: "ENTRY",
      price: 50,
      confidence: 3,
      setupQuality: 3,
      reasonCodes: [],
      notes: null,
      captureMode: "regular",
      visibleUntilTimestamp: "2024-01-02T14:30:00.000Z",
      potentialVisualLeakage: true,
      outcomeAvailable: true,
      indicatorSnapshot: {},
      structureSnapshot: {},
      drawingContext: {},
      multiTimeframeContext: {
        d1: { timestamp: "2024-01-04T21:00:00.000Z" },
        h4: {},
        h2: {}
      }
    });
    const server = serverWithDb();

    const response = await server.inject({
      method: "GET",
      url: `/export/trade-events/validation?sessionId=${sessionId}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "fail",
      summary: {
        totalLabels: 1,
        errorCount: 4,
        labelsByDecisionRole: { entry: 1 },
        labelsByBias: { unclear: 1 },
        labelsByTradeDirection: { observe_only: 1 },
        labelsWithMissingPairedContext: 1,
        labelsWithLeakageWarnings: 1,
        labelsWithIncompleteIntent: 1,
        labelsWithSetupId: 0,
        labelsWithTradeId: 0,
        labelsWithOutcomeAvailable: 1,
        labelsByOutcomeStatus: { computed: 1 },
        outcomeRuleVersions: { outcome_rule_v1: 1 },
        outcomeFieldsExcludedFromDecisionCsv: true
      },
      issues: expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "selected_timestamp_after_visible_until",
          labelId: created.id
        }),
        expect.objectContaining({
          severity: "error",
          code: "missing_indicator_snapshot",
          labelId: created.id
        }),
        expect.objectContaining({
          severity: "error",
          code: "missing_structure_snapshot",
          labelId: created.id
        }),
        expect.objectContaining({
          severity: "error",
          code: "d1_context_after_visible_until",
          labelId: created.id
        }),
        expect.objectContaining({
          severity: "warning",
          code: "potential_visual_leakage",
          labelId: created.id
        }),
        expect.objectContaining({
          severity: "warning",
          code: "missing_paired_context",
          labelId: created.id
        }),
        expect.objectContaining({
          severity: "warning",
          code: "entry_intent_incomplete",
          labelId: created.id
        }),
        expect.objectContaining({
          severity: "warning",
          code: "outcome_metadata_incomplete",
          labelId: created.id
        })
      ])
    });

    const blockedExport = await server.inject({
      method: "GET",
      url: `/export/trade-events?format=json&sessionId=${sessionId}`
    });

    expect(blockedExport.statusCode).toBe(409);
    expect(blockedExport.json()).toMatchObject({
      error: "Export blocked by validation errors",
      manifest: {
        qa: {
          status: "fail",
          blockers: 4
        },
        rowCount: 1
      }
    });

    await server.close();
  });

  it("warns when exit labels are not linked to a trade or parent label", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const sessionId = seedSession("session-1");
    const created = createTradeEvent(db, {
      sessionId,
      timestamp: "2024-01-03T14:30:00.000Z",
      ticker: "SOXL",
      timeframe: "4H",
      labelType: "EXIT",
      price: 51,
      confidence: 3,
      setupQuality: 3,
      reasonCodes: [],
      notes: null,
      captureMode: "replay",
      visibleUntilTimestamp: "2024-01-03T14:30:00.000Z",
      potentialVisualLeakage: false,
      indicatorSnapshot: {
        pairedTicker: {
          ticker: "SOXS",
          candle: { timestamp: "2024-01-03T14:30:00.000Z", close: 11.5 }
        }
      },
      structureSnapshot: {
        recentCandles: [{ timestamp: "2024-01-03T14:30:00.000Z", close: 51 }]
      },
      drawingContext: {},
      multiTimeframeContext: {
        d1: { timestamp: "2024-01-02T21:00:00.000Z" },
        h4: { timestamp: "2024-01-03T14:30:00.000Z" },
        h2: { timestamp: "2024-01-03T12:30:00.000Z" }
      }
    });
    const server = serverWithDb();

    const response = await server.inject({
      method: "GET",
      url: `/export/trade-events/validation?sessionId=${sessionId}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "warning",
      summary: {
        totalLabels: 1,
        errorCount: 0,
        warningCount: 1,
        labelsByDecisionRole: { exit: 1 },
        labelsByBias: { unclear: 1 },
        labelsByTradeDirection: { observe_only: 1 },
        labelsWithIncompleteIntent: 1,
        labelsWithSetupId: 0,
        labelsWithTradeId: 0
      },
      issues: [
        expect.objectContaining({
          severity: "warning",
          code: "exit_linkage_incomplete",
          labelId: created.id
        })
      ]
    });

    await server.close();
  });

  it("separates unresolved entry outcome status from computed outcomes", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const sessionId = seedSession("session-1");
    createTradeEvent(db, {
      sessionId,
      timestamp: "2024-01-03T14:30:00.000Z",
      ticker: "SOXL",
      timeframe: "4H",
      labelType: "ENTRY",
      price: 51,
      confidence: 3,
      setupQuality: 3,
      reasonCodes: [],
      notes: null,
      captureMode: "replay",
      visibleUntilTimestamp: "2024-01-03T14:30:00.000Z",
      potentialVisualLeakage: false,
      setupId: "setup-1",
      tradeId: "trade-1",
      bias: "long",
      tradeDirection: "long_ticker",
      indicatorSnapshot: {
        pairedTicker: {
          ticker: "SOXS",
          candle: { timestamp: "2024-01-03T14:30:00.000Z", close: 11.5 }
        }
      },
      structureSnapshot: {
        recentCandles: [{ timestamp: "2024-01-03T14:30:00.000Z", close: 51 }]
      },
      drawingContext: {},
      multiTimeframeContext: {
        d1: { timestamp: "2024-01-02T21:00:00.000Z" },
        h4: { timestamp: "2024-01-03T14:30:00.000Z" },
        h2: { timestamp: "2024-01-03T12:30:00.000Z" }
      }
    });
    const server = serverWithDb();

    const response = await server.inject({
      method: "GET",
      url: `/export/trade-events/validation?sessionId=${sessionId}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      summary: {
        labelsWithOutcomeAvailable: 0,
        labelsByOutcomeStatus: { missing_exit: 1 },
        outcomeRuleVersions: {}
      }
    });

    await server.close();
  });

  it("adds bad-source data-quality warnings to export validation without warning on review-only volatility", async () => {
    db = new Database(":memory:");
    runMigrations(db);
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
    const server = serverWithDb();

    const response = await server.inject({
      method: "GET",
      url: "/export/trade-events/validation"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "warning",
      summary: {
        totalLabels: 0,
        errorCount: 0,
        warningCount: 1
      },
      issues: [
        expect.objectContaining({
          severity: "warning",
          code: "data_quality_large_price_discontinuity",
          labelId: null,
          message: expect.stringContaining("SPY 1D")
        })
      ]
    });

    await server.close();
  });
});
