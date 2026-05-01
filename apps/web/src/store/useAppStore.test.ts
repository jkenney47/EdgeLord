import { describe, expect, it, vi } from "vitest";

import {
  createInitialState,
  multiTimeframeContextSnapshot,
  selectedCandleContext,
  visibleCandlesForMode
} from "./useAppStore";
import { useAppStore } from "./useAppStore";
import type {
  ChartCandle,
  ChartTimeframe,
  DataCoverageReport,
  ExportValidationReport,
  IndicatorSnapshot,
  SyncChartResponse,
  TradeEvent
} from "../api/client";

function candles(count: number): ChartCandle[] {
  return Array.from({ length: count }, (_, index) => ({
    ticker: "SOXL",
    timeframe: "4H",
    timestamp: `2024-01-${String(index + 1).padStart(2, "0")}T14:30:00.000Z`,
    open: 100 + index,
    high: 101 + index,
    low: 99 + index,
    close: 100.5 + index,
    volume: 1_000_000 + index,
    sourceBarCount: 240
  }));
}

function indicator(timestamp: string, timeframe: ChartTimeframe, index: number): IndicatorSnapshot {
  return {
    ticker: "SOXL",
    timeframe,
    timestamp,
    volume: 1_000_000 + index,
    volumeSma20: 900_000 + index,
    ema25: 100 + index,
    sma100: 90 + index,
    monthlyVwap: 95 + index,
    atr14Rma: 2 + index,
    smio: { erg: null, signal: null, oscillator: 0.1 + index },
    stochRsi: { rsi: null, stoch: null, k: 60 + index, d: 55 + index },
    cmWvf: {
      wvf: null,
      plot: -2 - index,
      upperBand: null,
      rangeHigh: null,
      filtered: false,
      filteredAggressive: false,
      alert1: false,
      alert2: false,
      alert3: false,
      alert4: false
    }
  };
}

function syncResponse(timeframe: ChartTimeframe, bars: ChartCandle[]): SyncChartResponse {
  const normalizedBars = bars.map((bar) => ({ ...bar, timeframe }));

  return {
    timeframe,
    tickers: ["SOXL"],
    timestamps: normalizedBars.map((bar) => bar.timestamp),
    series: {
      SOXL: {
        ticker: "SOXL",
        timeframe,
        candles: normalizedBars,
        indicators: normalizedBars.map((bar, index) => indicator(bar.timestamp, timeframe, index))
      }
    },
    warnings: []
  };
}

function tradeEvent(overrides: Partial<TradeEvent> = {}): TradeEvent {
  return {
    id: "label-1",
    sessionId: "session-1",
    timestamp: "2024-01-02T14:30:00.000Z",
    ticker: "SOXL",
    timeframe: "4H",
    labelType: "ENTRY",
    decisionPhase: "at_close",
    captureMode: "regular",
    visibleUntilTimestamp: "2024-01-02T14:30:00.000Z",
    potentialVisualLeakage: true,
    selectedBarIndex: 0,
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
    price: 100,
    confidence: 3,
    setupQuality: 3,
    reasonCodes: [],
    notes: null,
    indicatorSnapshot: {},
    structureSnapshot: {},
    drawingContext: {},
    createdAt: "2024-01-02T14:31:00.000Z",
    updatedAt: "2024-01-02T14:31:00.000Z",
    deletedAt: null,
    ...overrides
  };
}

function validationReport(labelIds: string[]): ExportValidationReport {
  return {
    status: labelIds.length > 0 ? "fail" : "pass",
    summary: {
      totalLabels: labelIds.length,
      errorCount: labelIds.length,
      warningCount: 0,
      labelsByTicker: {},
      labelsByTimeframe: {},
      labelsByLabelType: {},
      labelsByReplayMode: {},
      labelsByDecisionRole: {},
      labelsByBias: {},
      labelsByTradeDirection: {},
      labelsWithMissingPairedContext: 0,
      labelsWithLeakageWarnings: 0,
      labelsWithIncompleteIntent: 0,
      labelsWithSetupId: 0,
      labelsWithTradeId: 0,
      labelsWithOutcomeAvailable: 0,
      labelsByOutcomeStatus: {},
      outcomeRuleVersions: {},
      outcomeFieldsExcludedFromDecisionCsv: true
    },
    issues: labelIds.map((labelId) => ({
      severity: "error",
      code: "test_issue",
      labelId,
      message: "Test issue"
    }))
  };
}

describe("app store helpers", () => {
  it("shows all candles in regular mode", () => {
    expect(visibleCandlesForMode(candles(5), "regular", 2)).toHaveLength(5);
  });

  it("slices candles through the replay index in replay mode", () => {
    expect(visibleCandlesForMode(candles(5), "replay", 2).map((bar) => bar.timestamp)).toEqual([
      "2024-01-01T14:30:00.000Z",
      "2024-01-02T14:30:00.000Z",
      "2024-01-03T14:30:00.000Z"
    ]);
  });

  it("builds selected candle context with paired ticker data", () => {
    const timestamp = "2024-01-02T14:30:00.000Z";
    const soxlCandles = candles(3);
    const soxsCandles = candles(3).map((bar) => ({
      ...bar,
      ticker: "SOXS",
      high: bar.high - 80,
      low: bar.low - 80,
      close: bar.close - 80
    }));

    const context = selectedCandleContext({
      selectedCandle: {
        ticker: "SOXL",
        timestamp
      },
      syncData: {
        timeframe: "4H",
        tickers: ["SOXL", "SOXS"],
        timestamps: soxlCandles.map((bar) => bar.timestamp),
        series: {
          SOXL: {
            ticker: "SOXL",
            timeframe: "4H",
            candles: soxlCandles,
            indicators: [
              {
                ticker: "SOXL",
                timeframe: "4H",
                timestamp,
                volume: 1_000_000,
                volumeSma20: null,
                ema25: 100,
                sma100: null,
                monthlyVwap: null,
                atr14Rma: null,
                smio: { erg: null, signal: null, oscillator: 0.1 },
                stochRsi: { rsi: null, stoch: null, k: null, d: null },
                cmWvf: {
                  wvf: null,
                  plot: null,
                  upperBand: null,
                  rangeHigh: null,
                  filtered: false,
                  filteredAggressive: false,
                  alert1: false,
                  alert2: false,
                  alert3: false,
                  alert4: false
                }
              }
            ]
          },
          SOXS: {
            ticker: "SOXS",
            timeframe: "4H",
            candles: soxsCandles,
            indicators: [
              {
                ticker: "SOXS",
                timeframe: "4H",
                timestamp,
                volume: 1_000_000,
                volumeSma20: null,
                ema25: 20,
                sma100: null,
                monthlyVwap: null,
                atr14Rma: null,
                smio: { erg: null, signal: null, oscillator: -0.2 },
                stochRsi: { rsi: null, stoch: null, k: null, d: null },
                cmWvf: {
                  wvf: null,
                  plot: null,
                  upperBand: null,
                  rangeHigh: null,
                  filtered: false,
                  filteredAggressive: false,
                  alert1: false,
                  alert2: false,
                  alert3: false,
                  alert4: false
                }
              }
            ]
          }
        },
        warnings: []
      }
    });

    expect(context).toMatchObject({
      candle: {
        ticker: "SOXL",
        timestamp,
        close: 101.5
      },
      candleIndex: 1,
      indicator: {
        ema25: 100
      },
      pairedTicker: {
        ticker: "SOXS",
        candle: {
          close: 21.5
        },
        indicator: {
          ema25: 20
        },
        structureSnapshot: {
          recentHigh: 22,
          recentLow: 19,
          distanceToRecentHigh: 0.5,
          distanceToRecentLow: 2.5
        }
      },
      structureSnapshot: {
        recentHigh: 102,
        recentLow: 99,
        distanceToRecentHigh: 0.5,
        distanceToRecentLow: 2.5
      }
    });
  });

  it("builds multi-timeframe snapshots without using future candles", () => {
    const decisionTimestamp = "2024-01-03T14:30:00.000Z";
    const d1Bars: ChartCandle[] = [
      { ...candles(1)[0], timeframe: "1D", timestamp: "2024-01-01T21:00:00.000Z", close: 100 },
      { ...candles(1)[0], timeframe: "1D", timestamp: "2024-01-04T21:00:00.000Z", close: 104 }
    ];
    const h4Bars = candles(4);
    const h2Bars: ChartCandle[] = [
      { ...candles(1)[0], timeframe: "2H", timestamp: "2024-01-03T12:30:00.000Z", close: 101 },
      { ...candles(1)[0], timeframe: "2H", timestamp: "2024-01-03T16:30:00.000Z", close: 103 }
    ];

    const snapshot = multiTimeframeContextSnapshot(
      {
        syncData: syncResponse("4H", h4Bars),
        syncDataByTimeframe: {
          "1D": syncResponse("1D", d1Bars),
          "4H": syncResponse("4H", h4Bars),
          "2H": syncResponse("2H", h2Bars)
        }
      },
      "SOXL",
      decisionTimestamp
    );

    expect(snapshot).toMatchObject({
      d1: {
        timeframe: "1D",
        timestamp: "2024-01-01T21:00:00.000Z",
        contextAgeMinutes: 2490,
        candle: { close: 100 },
        indicator: { ema25: 100 },
        structureSnapshot: {
          recentHigh: 101,
          recentLow: 99,
          distanceToRecentHigh: 1,
          distanceToRecentLow: 1
        }
      },
      h4: {
        timeframe: "4H",
        timestamp: decisionTimestamp,
        contextAgeMinutes: 0,
        candle: { close: 102.5 },
        indicator: { ema25: 102 }
      },
      h2: {
        timeframe: "2H",
        timestamp: "2024-01-03T12:30:00.000Z",
        contextAgeMinutes: 120,
        candle: { close: 101 },
        indicator: { ema25: 100 }
      }
    });
  });

  it("starts in regular mode with no selected candle", () => {
    expect(createInitialState()).toMatchObject({
      mode: "regular",
      replayIndex: 0,
      replaySpeedMs: 500,
      selectedCandle: null,
      syncData: null,
      isLoadingChartData: false,
      labelStatus: null
    });
  });

  it("clears label status when candle context changes", () => {
    useAppStore.setState({
      ...createInitialState(),
      labelStatus: "Created label"
    });

    useAppStore.getState().selectCandle({
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: "2024-01-02T14:30:00.000Z"
    });

    expect(useAppStore.getState().labelStatus).toBeNull();
  });

  it("clears stale label status when create validation fails", async () => {
    useAppStore.setState({
      ...createInitialState(),
      labelStatus: "Created label"
    });

    await useAppStore.getState().submitLabel({
      labelType: "ENTRY",
      confidence: 3,
      setupQuality: 3,
      reasonCodes: [],
      notes: null
    });

    expect(useAppStore.getState()).toMatchObject({
      labelError: "Select a candle before labeling",
      labelStatus: null
    });
  });

  it("adds leakage metadata when submitting labels", async () => {
    const timestamp = "2024-01-02T14:30:00.000Z";
    const soxlCandles = candles(3);
    const createTradeEvent = vi.fn().mockResolvedValue({
      id: "label-1",
      sessionId: "session-1",
      timestamp,
      ticker: "SOXL",
      timeframe: "4H",
      labelType: "ENTRY",
      decisionPhase: "at_close",
      captureMode: "replay",
      visibleUntilTimestamp: timestamp,
      potentialVisualLeakage: false,
      selectedBarIndex: 1,
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
      price: 101.5,
      confidence: 3,
      setupQuality: 3,
      reasonCodes: [],
      notes: null,
      indicatorSnapshot: {},
      structureSnapshot: {},
      drawingContext: {},
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null
    });

    useAppStore.setState({
      ...createInitialState(),
      mode: "replay",
      replayIndex: 1,
      selectedCandle: {
        ticker: "SOXL",
        timeframe: "4H",
        timestamp
      },
      syncData: {
        timeframe: "4H",
        tickers: ["SOXL"],
        timestamps: soxlCandles.map((bar) => bar.timestamp),
        series: {
          SOXL: {
            ticker: "SOXL",
            timeframe: "4H",
            candles: soxlCandles,
            indicators: []
          }
        },
        warnings: []
      },
      activeSession: {
        id: "session-1",
        name: "Replay",
        startTime: timestamp,
        endTime: null,
        tickerFocus: "SOXL",
        timeframeFocus: "4H",
        notes: null,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      createTradeEvent,
      listTradeEvents: vi.fn().mockResolvedValue([]),
      fetchReviewSummary: vi.fn().mockResolvedValue(null)
    });

    await useAppStore.getState().submitLabel({
      labelType: "ENTRY",
      confidence: 3,
      setupQuality: 3,
      reasonCodes: [],
      notes: null
    });

    expect(createTradeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        decisionPhase: "at_close",
        captureMode: "replay",
        visibleUntilTimestamp: timestamp,
        potentialVisualLeakage: false,
        selectedBarIndex: 1,
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
        multiTimeframeContext: expect.objectContaining({
          d1: expect.objectContaining({
            timestamp: null
          }),
          h4: expect.objectContaining({
            timestamp,
            contextAgeMinutes: 0,
            candle: expect.objectContaining({ close: 101.5 })
          }),
          h2: expect.objectContaining({
            timestamp: null
          })
        })
      })
    );
    expect(useAppStore.getState()).toMatchObject({
      replayIndex: 2,
      selectedCandle: {
        ticker: "SOXL",
        timeframe: "4H",
        timestamp: soxlCandles[2].timestamp
      },
      isReplayPlaying: false,
      labelStatus: "Created label"
    });
  });

  it("flags regular-mode labels as potential visual leakage", async () => {
    const timestamp = "2024-01-02T14:30:00.000Z";
    const soxlCandles = candles(3);
    const createTradeEvent = vi.fn().mockResolvedValue({
      id: "label-1",
      sessionId: "session-1",
      timestamp,
      ticker: "SOXL",
      timeframe: "4H",
      labelType: "ENTRY",
      decisionPhase: "at_close",
      captureMode: "regular",
      visibleUntilTimestamp: timestamp,
      potentialVisualLeakage: true,
      selectedBarIndex: 1,
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
      price: 101.5,
      confidence: 3,
      setupQuality: 3,
      reasonCodes: [],
      notes: null,
      indicatorSnapshot: {},
      structureSnapshot: {},
      drawingContext: {},
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null
    });

    useAppStore.setState({
      ...createInitialState(),
      mode: "regular",
      selectedCandle: {
        ticker: "SOXL",
        timeframe: "4H",
        timestamp
      },
      syncData: {
        timeframe: "4H",
        tickers: ["SOXL"],
        timestamps: soxlCandles.map((bar) => bar.timestamp),
        series: {
          SOXL: {
            ticker: "SOXL",
            timeframe: "4H",
            candles: soxlCandles,
            indicators: []
          }
        },
        warnings: []
      },
      activeSession: {
        id: "session-1",
        name: "Regular review",
        startTime: timestamp,
        endTime: null,
        tickerFocus: "SOXL",
        timeframeFocus: "4H",
        notes: null,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      createTradeEvent,
      listTradeEvents: vi.fn().mockResolvedValue([]),
      fetchReviewSummary: vi.fn().mockResolvedValue(null)
    });

    await useAppStore.getState().submitLabel({
      labelType: "ENTRY",
      confidence: 3,
      setupQuality: 3,
      reasonCodes: [],
      notes: null
    });

    expect(createTradeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        captureMode: "regular",
        visibleUntilTimestamp: timestamp,
        potentialVisualLeakage: true,
        selectedBarIndex: 1,
        decisionRole: "entry",
        bias: "unclear",
        tradeDirection: "observe_only",
        pairedTickerRole: "ignored",
        multiTimeframeContext: expect.objectContaining({
          h4: expect.objectContaining({
            timestamp,
            contextAgeMinutes: 0
          })
        })
      })
    );
    expect(useAppStore.getState()).toMatchObject({
      replayIndex: 0,
      selectedCandle: {
        ticker: "SOXL",
        timeframe: "4H",
        timestamp
      },
      labelStatus: "Created label"
    });
  });

  it("clears stale label status when update or delete validation fails", async () => {
    useAppStore.setState({
      ...createInitialState(),
      labelStatus: "Updated label"
    });

    await useAppStore.getState().updateLabel("label-1", {
      labelType: "EXIT",
      timestamp: "2024-01-02T14:30:00.000Z",
      ticker: "SOXL",
      timeframe: "4H",
      price: 101,
      confidence: 3,
      setupQuality: 3,
      reasonCodes: [],
      notes: null,
      decisionPhase: "at_close",
      captureMode: "replay",
      visibleUntilTimestamp: "2024-01-03T14:30:00.000Z",
      potentialVisualLeakage: false,
      selectedBarIndex: 1,
      multiTimeframeContext: {},
      indicatorSnapshot: {},
      structureSnapshot: {},
      drawingContext: {}
    });

    expect(useAppStore.getState()).toMatchObject({
      labelError: "No active session selected",
      labelStatus: null
    });

    useAppStore.setState({
      labelError: null,
      labelStatus: "Deleted label"
    });

    await useAppStore.getState().deleteLabel("label-1");

    expect(useAppStore.getState()).toMatchObject({
      labelError: "No active session selected",
      labelStatus: null
    });
  });

  it("calculates outcomes and refreshes label review data", async () => {
    const timestamp = "2024-01-02T14:30:00.000Z";
    const updatedLabel = {
      id: "label-1",
      sessionId: "session-1",
      timestamp,
      ticker: "SOXL",
      timeframe: "4H",
      labelType: "ENTRY",
      decisionPhase: "at_close",
      captureMode: "replay",
      visibleUntilTimestamp: timestamp,
      potentialVisualLeakage: false,
      selectedBarIndex: 1,
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
      outcomeAvailable: true,
      outcomeHorizonBars: 10,
      outcomeFutureReturn1: 1.25,
      outcomeFutureReturn3: null,
      outcomeFutureReturn5: null,
      outcomeFutureReturn10: null,
      outcomeFutureMaxFavorableExcursion: 3.5,
      outcomeFutureMaxAdverseExcursion: -1.5,
      outcomeFutureHitTarget: null,
      outcomeFutureHitStop: null,
      outcomeFutureBarsToTarget: null,
      outcomeFutureBarsToStop: null,
      multiTimeframeContext: {},
      price: 101.5,
      confidence: 3,
      setupQuality: 3,
      reasonCodes: [],
      notes: null,
      indicatorSnapshot: {},
      structureSnapshot: {},
      drawingContext: {},
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null
    } as const;
    const calculateLabelOutcome = vi.fn().mockResolvedValue(updatedLabel);
    const listTradeEvents = vi.fn().mockResolvedValue([updatedLabel]);
    const fetchReviewSummary = vi.fn().mockResolvedValue({ totalLabels: 1 });
    const fetchExportValidationReport = vi.fn().mockResolvedValue({
      status: "pass",
      summary: { totalLabels: 1 },
      issues: []
    });

    useAppStore.setState({
      ...createInitialState(),
      activeSession: {
        id: "session-1",
        name: "Replay",
        startTime: timestamp,
        endTime: null,
        tickerFocus: "SOXL",
        timeframeFocus: "4H",
        notes: null,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      selectedLabelId: "label-1",
      calculateLabelOutcome,
      listTradeEvents,
      fetchReviewSummary,
      fetchExportValidationReport
    });

    await useAppStore.getState().calculateOutcome();

    expect(calculateLabelOutcome).toHaveBeenCalledWith("label-1", { horizonBars: 10 });
    expect(listTradeEvents).toHaveBeenCalledWith("session-1");
    expect(fetchReviewSummary).toHaveBeenCalledWith("session-1");
    expect(fetchExportValidationReport).toHaveBeenCalledWith("session-1");
    expect(useAppStore.getState()).toMatchObject({
      labelStatus: "Calculated outcome",
      selectedLabelId: "label-1",
      lastCreatedLabelId: "label-1",
      sessionLabels: [updatedLabel],
      isSavingLabel: false
    });
  });

  it("imports market data and refreshes chart data", async () => {
    const importMarketData = vi.fn().mockResolvedValue({
      importRunId: "run-1",
      provider: "alpaca",
      tickers: ["SOXL", "SOXS"],
      baseBarsInserted: 480,
      aggregatedBarsInserted: 2,
      alignedTimestamps: ["2024-01-02T14:30:00.000Z"],
      warnings: []
    });
    const fetchSynchronizedChartData = vi.fn().mockResolvedValue({
      timeframe: "4H",
      tickers: ["SOXL", "SOXS"],
      timestamps: ["2024-01-02T14:30:00.000Z"],
      series: {}
    });
    const listDrawings = vi.fn().mockResolvedValue([]);
    const fetchDataCoverage = vi.fn().mockResolvedValue({
      tickers: ["SOXL", "SOXS"],
      timeframes: ["1D", "4H", "2H"],
      summaries: [],
      gaps: []
    });

    useAppStore.setState({
      ...createInitialState(),
      importMarketData,
      fetchSynchronizedChartData,
      fetchDataCoverage,
      listDrawings
    });

    await useAppStore.getState().runImport();

    expect(importMarketData).toHaveBeenCalledWith({
      tickers: ["SOXL", "SOXS"],
      startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      baseTimeframe: "5Min"
    });
    expect(fetchSynchronizedChartData).toHaveBeenCalledTimes(3);
    expect(fetchSynchronizedChartData).toHaveBeenCalledWith(["SOXL", "SOXS"], "1D");
    expect(fetchSynchronizedChartData).toHaveBeenCalledWith(["SOXL", "SOXS"], "4H");
    expect(fetchSynchronizedChartData).toHaveBeenCalledWith(["SOXL", "SOXS"], "2H");
    expect(listDrawings).toHaveBeenCalledWith("SOXL", "4H");
    expect(listDrawings).toHaveBeenCalledWith("SOXS", "4H");
    expect(listDrawings).toHaveBeenCalledWith("SOXL", "1D");
    expect(listDrawings).toHaveBeenCalledWith("SOXS", "2H");
    expect(useAppStore.getState()).toMatchObject({
      isImporting: false,
      importError: null,
      lastImportResult: {
        baseBarsInserted: 480,
        aggregatedBarsInserted: 2
      },
      syncData: {
        timestamps: ["2024-01-02T14:30:00.000Z"]
      }
    });
  });

  it("imports the user-selected date range and refreshes coverage", async () => {
    const importMarketData = vi.fn().mockResolvedValue({
      importRunId: "run-1",
      provider: "alpaca",
      tickers: ["SOXL", "SOXS"],
      baseBarsInserted: 480,
      aggregatedBarsInserted: 2,
      alignedTimestamps: ["2024-01-02T14:30:00.000Z"],
      warnings: []
    });
    const fetchSynchronizedChartData = vi.fn().mockResolvedValue({
      timeframe: "4H",
      tickers: ["SOXL", "SOXS"],
      timestamps: ["2024-01-02T14:30:00.000Z"],
      series: {},
      warnings: []
    });
    const dataCoverage: DataCoverageReport = {
      tickers: ["SOXL", "SOXS"],
      timeframes: ["1D", "4H", "2H"],
      summaries: [],
      gaps: []
    };
    const fetchDataCoverage = vi.fn().mockResolvedValue(dataCoverage);

    useAppStore.setState({
      ...createInitialState(),
      importStartDate: "2024-01-01",
      importEndDate: "2026-04-28",
      importBaseTimeframe: "5Min",
      importMarketData,
      fetchSynchronizedChartData,
      fetchDataCoverage,
      listDrawings: vi.fn().mockResolvedValue([])
    });

    await useAppStore.getState().runImport();

    expect(importMarketData).toHaveBeenCalledWith({
      tickers: ["SOXL", "SOXS"],
      startDate: "2024-01-01",
      endDate: "2026-04-28",
      baseTimeframe: "5Min"
    });
    expect(fetchDataCoverage).toHaveBeenCalledWith(["SOXL", "SOXS"], ["1D", "4H", "2H"]);
    expect(useAppStore.getState().dataCoverage).toBe(dataCoverage);
  });

  it("clears stale import success when an import fails", async () => {
    useAppStore.setState({
      ...createInitialState(),
      lastImportResult: {
        importRunId: "stale-run",
        provider: "alpaca",
        tickers: ["SOXL", "SOXS"],
        baseBarsInserted: 480,
        aggregatedBarsInserted: 2,
        alignedTimestamps: ["2024-01-02T14:30:00.000Z"],
        warnings: []
      },
      importMarketData: vi.fn().mockRejectedValue(new Error("Import failed"))
    });

    await useAppStore.getState().runImport();

    expect(useAppStore.getState()).toMatchObject({
      isImporting: false,
      importError: "Import failed",
      lastImportResult: null
    });
  });

  it("clears stale import status when import controls change", () => {
    useAppStore.setState({
      ...createInitialState(),
      importError: "Import failed",
      lastImportResult: {
        importRunId: "stale-run",
        provider: "alpaca",
        tickers: ["SOXL", "SOXS"],
        baseBarsInserted: 480,
        aggregatedBarsInserted: 2,
        alignedTimestamps: ["2024-01-02T14:30:00.000Z"],
        warnings: []
      }
    });

    useAppStore.getState().setImportStartDate("2024-01-01");

    expect(useAppStore.getState()).toMatchObject({
      importStartDate: "2024-01-01",
      importError: null,
      lastImportResult: null
    });
  });

  it("starts replay from the first synchronized timestamp on or after a date", () => {
    useAppStore.setState({
      ...createInitialState(),
      syncData: {
        timeframe: "4H",
        tickers: ["SOXL", "SOXS"],
        timestamps: [
          "2024-01-02T14:30:00.000Z",
          "2024-01-03T14:30:00.000Z",
          "2024-01-05T14:30:00.000Z"
        ],
        series: {},
        warnings: []
      }
    });

    useAppStore.getState().setReplayStartDate("2024-01-04");

    expect(useAppStore.getState()).toMatchObject({
      mode: "replay",
      replayIndex: 2,
      replayStartDate: "2024-01-04",
      isReplayPlaying: false
    });
  });

  it("stops playback at the final replay index", () => {
    useAppStore.setState({
      ...createInitialState(),
      mode: "replay",
      replayIndex: 1,
      isReplayPlaying: true,
      syncData: {
        timeframe: "4H",
        tickers: ["SOXL", "SOXS"],
        timestamps: [
          "2024-01-02T14:30:00.000Z",
          "2024-01-03T14:30:00.000Z"
        ],
        series: {},
        warnings: []
      }
    });

    useAppStore.getState().stepForward();

    expect(useAppStore.getState()).toMatchObject({
      replayIndex: 1,
      isReplayPlaying: false
    });
  });

  it("focuses a label by selecting its candle and replay index", async () => {
    useAppStore.setState({
      ...createInitialState(),
      mode: "replay",
      replayIndex: 0,
      isReplayPlaying: true,
      syncData: {
        timeframe: "4H",
        tickers: ["SOXL", "SOXS"],
        timestamps: [
          "2024-01-02T14:30:00.000Z",
          "2024-01-03T14:30:00.000Z"
        ],
        series: {},
        warnings: []
      }
    });

    await useAppStore.getState().focusLabel({
      id: "label-1",
      sessionId: "session-1",
      timestamp: "2024-01-03T14:30:00.000Z",
      ticker: "SOXL",
      timeframe: "4H",
      labelType: "ENTRY",
      decisionPhase: "at_close",
      captureMode: "replay",
      visibleUntilTimestamp: "2024-01-03T14:30:00.000Z",
      potentialVisualLeakage: false,
      selectedBarIndex: 1,
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
      price: 12,
      confidence: 3,
      setupQuality: 3,
      reasonCodes: [],
      notes: null,
      indicatorSnapshot: {},
      structureSnapshot: {},
      drawingContext: {},
      createdAt: "2024-01-03T14:31:00.000Z",
      updatedAt: "2024-01-03T14:31:00.000Z",
      deletedAt: null
    });

    expect(useAppStore.getState()).toMatchObject({
      selectedCandle: {
        ticker: "SOXL",
        timestamp: "2024-01-03T14:30:00.000Z"
      },
      replayIndex: 1,
      isReplayPlaying: false
    });
  });

  it("moves through session labels in chronological order", async () => {
    const labels = [
      tradeEvent({
        id: "label-2",
        timestamp: "2024-01-03T14:30:00.000Z",
        createdAt: "2024-01-03T14:31:00.000Z",
        updatedAt: "2024-01-03T14:31:00.000Z"
      }),
      tradeEvent({
        id: "label-1",
        timestamp: "2024-01-02T14:30:00.000Z"
      })
    ];
    useAppStore.setState({
      ...createInitialState(),
      syncData: {
        timeframe: "4H",
        tickers: ["SOXL"],
        timestamps: [
          "2024-01-02T14:30:00.000Z",
          "2024-01-03T14:30:00.000Z"
        ],
        series: {},
        warnings: []
      },
      sessionLabels: labels
    });

    await useAppStore.getState().focusAdjacentLabel(1);
    expect(useAppStore.getState().selectedLabelId).toBe("label-1");

    await useAppStore.getState().focusAdjacentLabel(1);
    expect(useAppStore.getState().selectedLabelId).toBe("label-2");

    await useAppStore.getState().focusAdjacentLabel(1);
    expect(useAppStore.getState().selectedLabelId).toBe("label-1");
  });

  it("jumps between labels with validation issues", async () => {
    const labels = [
      tradeEvent({
        id: "label-clean",
        timestamp: "2024-01-02T14:30:00.000Z"
      }),
      tradeEvent({
        id: "label-issue-1",
        timestamp: "2024-01-03T14:30:00.000Z",
        createdAt: "2024-01-03T14:31:00.000Z",
        updatedAt: "2024-01-03T14:31:00.000Z"
      }),
      tradeEvent({
        id: "label-issue-2",
        timestamp: "2024-01-04T14:30:00.000Z",
        createdAt: "2024-01-04T14:31:00.000Z",
        updatedAt: "2024-01-04T14:31:00.000Z"
      })
    ];
    useAppStore.setState({
      ...createInitialState(),
      syncData: {
        timeframe: "4H",
        tickers: ["SOXL"],
        timestamps: labels.map((label) => label.timestamp),
        series: {},
        warnings: []
      },
      sessionLabels: labels,
      exportValidationReport: validationReport(["label-issue-1", "label-issue-2"])
    });

    await useAppStore.getState().focusNextValidationIssue(1);
    expect(useAppStore.getState().selectedLabelId).toBe("label-issue-1");

    await useAppStore.getState().focusNextValidationIssue(1);
    expect(useAppStore.getState().selectedLabelId).toBe("label-issue-2");

    await useAppStore.getState().focusNextValidationIssue(-1);
    expect(useAppStore.getState().selectedLabelId).toBe("label-issue-1");
  });

  it("moves the selected candle by one bar and stops replay playback", () => {
    const soxlCandles = candles(3);
    useAppStore.setState({
      ...createInitialState(),
      mode: "replay",
      replayIndex: 1,
      isReplayPlaying: true,
      selectedCandle: {
        ticker: "SOXL",
        timestamp: soxlCandles[1].timestamp
      },
      syncData: {
        timeframe: "4H",
        tickers: ["SOXL", "SOXS"],
        timestamps: soxlCandles.map((bar) => bar.timestamp),
        series: {
          SOXL: {
            ticker: "SOXL",
            timeframe: "4H",
            candles: soxlCandles,
            indicators: []
          },
          SOXS: {
            ticker: "SOXS",
            timeframe: "4H",
            candles: soxlCandles.map((bar) => ({ ...bar, ticker: "SOXS" })),
            indicators: []
          }
        },
        warnings: []
      }
    });

    useAppStore.getState().moveSelectedCandle(1);

    expect(useAppStore.getState()).toMatchObject({
      selectedCandle: {
        ticker: "SOXL",
        timestamp: soxlCandles[2].timestamp
      },
      replayIndex: 2,
      isReplayPlaying: false
    });
  });

  it("starts keyboard-style navigation from the focused ticker and timeframe when none is selected", () => {
    const soxlCandles = candles(3);
    const soxsCandles = soxlCandles.map((bar) => ({ ...bar, ticker: "SOXS" }));
    useAppStore.setState({
      ...createInitialState(),
      focusedTicker: "SOXS",
      syncData: {
        timeframe: "4H",
        tickers: ["SOXL", "SOXS"],
        timestamps: soxlCandles.map((bar) => bar.timestamp),
        series: {
          SOXL: {
            ticker: "SOXL",
            timeframe: "4H",
            candles: soxlCandles,
            indicators: []
          },
          SOXS: {
            ticker: "SOXS",
            timeframe: "4H",
            candles: soxsCandles,
            indicators: []
          }
        },
        warnings: []
      }
    });

    useAppStore.getState().moveSelectedCandle(-1);

    expect(useAppStore.getState().selectedCandle).toEqual({
      ticker: "SOXS",
      timeframe: "4H",
      timestamp: soxsCandles[1].timestamp
    });
  });

  it("moves drawing anchors for levels as well as trendlines", async () => {
    const updateDrawing = vi.fn().mockResolvedValue({
      id: "drawing-1",
      sessionId: null,
      ticker: "SOXL",
      timeframe: "4H",
      type: "horizontal_level",
      anchors: [{ timestamp: "2024-01-02T14:30:00.000Z", price: 105.25 }],
      style: { color: "#6aa9ff" },
      slope: null,
      createdAt: "2024-01-02T14:30:00.000Z",
      updatedAt: "2024-01-02T14:31:00.000Z",
      deletedAt: null
    });

    useAppStore.setState({
      ...createInitialState(),
      updateDrawing,
      drawings: [
        {
          id: "drawing-1",
          sessionId: null,
          ticker: "SOXL",
          timeframe: "4H",
          type: "horizontal_level",
          anchors: [{ timestamp: "2024-01-02T14:30:00.000Z", price: 100.5 }],
          style: { color: "#6aa9ff" },
          slope: null,
          createdAt: "2024-01-02T14:30:00.000Z",
          updatedAt: "2024-01-02T14:30:00.000Z",
          deletedAt: null
        }
      ]
    });

    await useAppStore.getState().moveTrendlineAnchor("drawing-1", 0, {
      timestamp: "2024-01-02T14:30:00.000Z",
      price: 105.25
    });

    expect(updateDrawing).toHaveBeenCalledWith("drawing-1", {
      anchors: [{ timestamp: "2024-01-02T14:30:00.000Z", price: 105.25 }]
    });
    expect(useAppStore.getState().drawings[0].anchors[0].price).toBe(105.25);
  });

  it("selects a drawing and focuses its ticker and timeframe", () => {
    const soxlCandles = candles(2);
    const twoHourData = syncResponse("2H", soxlCandles);

    useAppStore.setState({
      ...createInitialState(),
      activeTimeframe: "4H",
      focusedTicker: "SOXL",
      syncData: syncResponse("4H", soxlCandles),
      syncDataByTimeframe: {
        "2H": twoHourData
      },
      drawings: [
        {
          id: "drawing-1",
          sessionId: null,
          ticker: "SOXS",
          timeframe: "2H",
          type: "horizontal_level",
          anchors: [{ timestamp: "2024-01-02T14:30:00.000Z", price: 100.5 }],
          style: { color: "#6aa9ff" },
          slope: null,
          createdAt: "2024-01-02T14:30:00.000Z",
          updatedAt: "2024-01-02T14:30:00.000Z",
          deletedAt: null
        }
      ]
    });

    useAppStore.getState().selectDrawing("drawing-1");

    expect(useAppStore.getState()).toMatchObject({
      selectedDrawingId: "drawing-1",
      focusedTicker: "SOXS",
      activeTimeframe: "2H",
      syncData: twoHourData,
      drawingMode: null,
      drawingStatus: "Selected SOXS 2H horizontal level"
    });
  });

  it("ignores trendline anchor moves that would collapse both endpoints onto one candle", async () => {
    const updateDrawing = vi.fn();

    useAppStore.setState({
      ...createInitialState(),
      updateDrawing,
      drawings: [
        {
          id: "drawing-1",
          sessionId: null,
          ticker: "SOXL",
          timeframe: "4H",
          type: "trendline",
          anchors: [
            { timestamp: "2024-01-02T14:30:00.000Z", price: 100.5 },
            { timestamp: "2024-01-03T14:30:00.000Z", price: 101.5 }
          ],
          style: { color: "#f2d35e" },
          slope: null,
          createdAt: "2024-01-02T14:30:00.000Z",
          updatedAt: "2024-01-02T14:30:00.000Z",
          deletedAt: null
        }
      ]
    });

    await useAppStore.getState().moveTrendlineAnchor("drawing-1", 1, {
      timestamp: "2024-01-02T14:30:00.000Z",
      price: 99.25
    });

    expect(updateDrawing).not.toHaveBeenCalled();
    expect(useAppStore.getState().drawings[0].anchors).toEqual([
      { timestamp: "2024-01-02T14:30:00.000Z", price: 100.5 },
      { timestamp: "2024-01-03T14:30:00.000Z", price: 101.5 }
    ]);
  });
});
