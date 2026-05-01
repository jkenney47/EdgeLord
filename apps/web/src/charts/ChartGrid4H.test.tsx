import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChartGrid4H } from "./ChartGrid4H";
import { candleIndexFromPointerRatio } from "./chartMath";
import { createInitialState, useAppStore } from "../store/useAppStore";
import type {
  ChartTimeframe,
  ExportValidationIssue,
  ExportValidationReport,
  IndicatorSnapshot,
  SyncChartResponse,
  TradeEvent
} from "../api/client";

function indicator(
  ticker: string,
  timestamp: string,
  timeframe: ChartTimeframe = "4H",
  index = 0
): IndicatorSnapshot {
  return {
    ticker,
    timeframe,
    timestamp,
    volume: 100,
    volumeSma20: 100,
    ema25: 10,
    sma100: 9,
    monthlyVwap: 8,
    atr14Rma: 2 + index,
    smio: { erg: 1, signal: 0.5, oscillator: 0.5 + index },
    stochRsi: { rsi: 50, stoch: 60, k: 70 + index, d: 80 + index },
    cmWvf: {
      wvf: 2,
      plot: -2 - index,
      upperBand: 3,
      rangeHigh: 4,
      filtered: false,
      filteredAggressive: false,
      alert1: false,
      alert2: false,
      alert3: false,
      alert4: false
    }
  };
}

function syncData(timeframe: ChartTimeframe = "4H"): SyncChartResponse {
  const timestamps = [
    "2024-01-02T14:30:00.000Z",
    "2024-01-03T14:30:00.000Z"
  ];

  return {
    timeframe,
    tickers: ["SOXL", "SOXS"],
    timestamps,
    series: Object.fromEntries(
      ["SOXL", "SOXS"].map((ticker) => [
        ticker,
        {
          ticker,
          timeframe,
          candles: timestamps.map((timestamp, index) => ({
            ticker,
            timeframe,
            timestamp,
            open: 10 + index,
            high: 12 + index,
            low: 9 + index,
            close: 11 + index,
            volume: 1000 + index,
            sourceBarCount: 240
          })),
          indicators: timestamps.map((timestamp, index) => indicator(ticker, timestamp, timeframe, index))
        }
      ])
    ),
    warnings: []
  };
}

function chartLabel(overrides: Partial<TradeEvent> = {}): TradeEvent {
  const timestamp = overrides.timestamp ?? "2024-01-03T14:30:00.000Z";
  const labelType = overrides.labelType ?? "ENTRY";

  return {
    id: overrides.id ?? "label-1",
    sessionId: "session-1",
    timestamp,
    ticker: overrides.ticker ?? "SOXL",
    timeframe: overrides.timeframe ?? "4H",
    labelType,
    price: overrides.price ?? 12,
    confidence: 3,
    setupQuality: 4,
    reasonCodes: [],
    notes: null,
    decisionPhase: "at_close",
    captureMode: "regular",
    visibleUntilTimestamp: timestamp,
    potentialVisualLeakage: true,
    selectedBarIndex: 2,
    setupId: null,
    tradeId: null,
    parentLabelId: null,
    decisionRole: labelType === "EXIT" ? "exit" : labelType === "SKIP" ? "skip" : labelType === "INVALID" ? "invalid" : "entry",
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
    indicatorSnapshot: {},
    structureSnapshot: {},
    drawingContext: {},
    createdAt: "2024-01-03T14:31:00.000Z",
    updatedAt: "2024-01-03T14:31:00.000Z",
    deletedAt: null,
    ...overrides
  };
}

function validationReport(issues: ExportValidationIssue[]): ExportValidationReport {
  return {
    status: issues.some((issue) => issue.severity === "error") ? "fail" : issues.length ? "warning" : "pass",
    summary: {
      totalLabels: 0,
      errorCount: issues.filter((issue) => issue.severity === "error").length,
      warningCount: issues.filter((issue) => issue.severity === "warning").length,
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
    issues
  };
}

describe("ChartGrid4H", () => {
  beforeEach(() => {
    useAppStore.setState({
      ...createInitialState(),
      mode: "regular",
      replayIndex: 0,
      selectedCandle: null,
      syncData: syncData(),
      syncDataByTimeframe: {
        "1D": syncData("1D"),
        "4H": syncData("4H"),
        "2H": syncData("2H")
      },
      createDrawing: vi.fn().mockImplementation((request) =>
        Promise.resolve({
          id: "drawing-1",
          sessionId: null,
          ticker: request.ticker,
          timeframe: request.timeframe,
          type: request.type,
          anchors: request.anchors,
          style: request.style,
          slope: 0,
          createdAt: "2024-01-02T14:30:00.000Z",
          updatedAt: "2024-01-02T14:30:00.000Z",
          deletedAt: null
        })
      ),
      updateDrawing: vi.fn(),
      deleteDrawing: vi.fn().mockResolvedValue({
        id: "drawing-1",
        sessionId: null,
        ticker: "SOXL",
        timeframe: "4H",
        type: "trendline",
        anchors: [
          { timestamp: "2024-01-02T14:30:00.000Z", price: 11 },
          { timestamp: "2024-01-03T14:30:00.000Z", price: 12 }
        ],
        style: { color: "#f2d35e" },
        slope: 0,
        createdAt: "2024-01-02T14:30:00.000Z",
        updatedAt: "2024-01-02T14:30:00.000Z",
        deletedAt: "2024-01-02T14:31:00.000Z"
      })
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders SOXL and SOXS 4H panels from store data", () => {
    render(<ChartGrid4H />);

    expect(screen.getByLabelText("SOXL 4H chart")).toBeInTheDocument();
    expect(screen.getByLabelText("SOXS 4H chart")).toBeInTheDocument();
    expect(screen.getByLabelText("SOXL 1D chart")).toBeInTheDocument();
    expect(screen.getByLabelText("SOXL 2H chart")).toBeInTheDocument();
    expect(screen.getByLabelText("SOXL 4H chart")).toHaveClass("focused");
    expect(screen.getByLabelText("SOXS 4H chart")).not.toHaveClass("focused");
    expect(within(screen.getByLabelText("SOXL 4H chart")).getByLabelText("SOXL price scale")).toBeInTheDocument();
    expect(within(screen.getByLabelText("SOXL 4H chart")).getByLabelText("SOXL time axis")).toBeInTheDocument();
    expect(screen.getAllByText("No candle selected")).toHaveLength(6);
    expect(screen.getAllByText("Selected")).toHaveLength(6);
    expect(screen.getAllByLabelText(/compact indicator states/)).toHaveLength(6);
    expect(screen.getAllByText("SMIO")).toHaveLength(6);
    expect(screen.getAllByText("Stoch")).toHaveLength(6);
    expect(screen.queryByText("Stoch RSI 7 10 14 15")).not.toBeInTheDocument();
  });

  it("maps chart hover ratios to stable candle buckets", () => {
    expect(candleIndexFromPointerRatio(-0.1, 4)).toBe(0);
    expect(candleIndexFromPointerRatio(0, 4)).toBe(0);
    expect(candleIndexFromPointerRatio(0.24, 4)).toBe(0);
    expect(candleIndexFromPointerRatio(0.25, 4)).toBe(1);
    expect(candleIndexFromPointerRatio(0.5, 4)).toBe(2);
    expect(candleIndexFromPointerRatio(0.99, 4)).toBe(3);
    expect(candleIndexFromPointerRatio(1, 4)).toBe(3);
    expect(candleIndexFromPointerRatio(0.5, 0)).toBeNull();
  });

  it("uses warm-up text when indicators are not ready", () => {
    const warmSyncData = (timeframe: ChartTimeframe) => {
      const data = syncData(timeframe);
      return {
        ...data,
        series: Object.fromEntries(
          Object.entries(data.series).map(([ticker, series]) => [
            ticker,
            {
              ...series,
              indicators: series.indicators.map((item) => ({
                ...item,
                ema25: null,
                sma100: null,
                monthlyVwap: null,
                atr14Rma: null,
                smio: { erg: null, signal: null, oscillator: null },
                stochRsi: { rsi: null, stoch: null, k: null, d: null },
                cmWvf: {
                  ...item.cmWvf,
                  wvf: null,
                  plot: null,
                  upperBand: null,
                  rangeHigh: null
                }
              }))
            }
          ])
        )
      };
    };

    useAppStore.setState({
      syncData: warmSyncData("4H"),
      syncDataByTimeframe: {
        "1D": warmSyncData("1D"),
        "4H": warmSyncData("4H"),
        "2H": warmSyncData("2H")
      }
    });

    render(<ChartGrid4H />);

    expect(screen.getAllByText(/EMA 25 warming/)).toHaveLength(6);
    expect(screen.getAllByText("warming").length).toBeGreaterThanOrEqual(10);
    expect(screen.queryByText("needs more candles")).not.toBeInTheDocument();
    expect(screen.getAllByText("WVF")).toHaveLength(6);
  });

  it("renders indicator pane charts for each pane", () => {
    useAppStore.setState({
      chartLayoutMode: "focused",
      activeTimeframe: "4H",
      focusedTicker: "SOXL"
    });

    render(<ChartGrid4H />);

    const soxlChart = screen.getByLabelText("SOXL 4H chart");
    expect(soxlChart.querySelectorAll(".indicator-chart")).toHaveLength(4);
    expect(soxlChart.querySelectorAll(".indicator-scale")).toHaveLength(4);
    expect(soxlChart.querySelectorAll(".indicator-strip.smio-pane")).toHaveLength(1);
    expect(soxlChart.querySelectorAll(".indicator-strip.stoch-rsi-pane")).toHaveLength(1);
    expect(soxlChart.querySelectorAll(".indicator-strip.cm-wvf-pane")).toHaveLength(1);
    expect(soxlChart.querySelectorAll(".indicator-strip.atr-pane")).toHaveLength(1);
    expect(soxlChart.querySelectorAll(".indicator-value-tag")).toHaveLength(6);
    expect(soxlChart.querySelectorAll(".indicator-reference-band")).toHaveLength(1);
    expect(soxlChart.querySelectorAll(".mini-bar")).toHaveLength(4);
    expect(soxlChart.querySelectorAll(".mini-bar.cm-wvf-muted")).toHaveLength(2);
    expect(soxlChart.querySelectorAll(".indicator-line.primary")).toHaveLength(2);
    expect(soxlChart.querySelectorAll(".indicator-line.secondary")).toHaveLength(1);
  });

  it("renders the active selected timeframe", () => {
    useAppStore.setState({
      activeTimeframe: "2H",
      syncData: {
        ...syncData(),
        timeframe: "2H",
        series: Object.fromEntries(
          Object.entries(syncData().series).map(([ticker, series]) => [
            ticker,
            {
              ...series,
              timeframe: "2H",
              candles: series.candles.map((candle) => ({ ...candle, timeframe: "2H" })),
              indicators: series.indicators.map((item) => ({ ...item, timeframe: "2H" }))
            }
          ])
        )
      }
    });

    render(<ChartGrid4H />);

    expect(screen.getByLabelText("SOXL 2H chart")).toBeInTheDocument();
    expect(screen.getByLabelText("SOXS 2H chart")).toBeInTheDocument();
  });

  it("marks the focused ticker for narrow chart mode", () => {
    useAppStore.setState({
      focusedTicker: "SOXS"
    });

    render(<ChartGrid4H />);

    expect(screen.getByLabelText("SOXL 4H chart")).not.toHaveClass("focused");
    expect(screen.getByLabelText("SOXS 4H chart")).toHaveClass("focused");
  });

  it("focuses the interacted chart ticker and timeframe", async () => {
    render(<ChartGrid4H />);
    const soxs2hChart = screen.getByLabelText("SOXS 2H chart");

    await userEvent.click(
      within(soxs2hChart).getByTitle("2024-01-03T14:30:00.000Z close 12.00")
    );

    expect(useAppStore.getState()).toMatchObject({
      activeTimeframe: "2H",
      focusedTicker: "SOXS",
      selectedCandle: {
        ticker: "SOXS",
        timeframe: "2H",
        timestamp: "2024-01-03T14:30:00.000Z"
      }
    });
  });

  it("expands the selected chart panel and restores the grid", async () => {
    render(<ChartGrid4H />);

    await userEvent.click(screen.getByRole("button", { name: "Focus SOXS 2H chart panel" }));

    expect(useAppStore.getState()).toMatchObject({
      chartLayoutMode: "focused",
      activeTimeframe: "2H",
      focusedTicker: "SOXS"
    });
    expect(screen.getByLabelText("Synchronized multi-timeframe chart grid")).toHaveClass("focused-layout");
    expect(screen.getByLabelText("SOXS 2H chart")).toHaveClass("focused", "expanded");
    expect(screen.getByRole("button", { name: "Show all chart panels" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Show all chart panels" }));

    expect(useAppStore.getState().chartLayoutMode).toBe("grid");
    expect(screen.getByLabelText("Synchronized multi-timeframe chart grid")).toHaveClass("grid-layout");
  });

  it("slices visible candles in replay mode", () => {
    useAppStore.setState({
      mode: "replay",
      replayIndex: 0
    });

    render(<ChartGrid4H />);

    expect(screen.getAllByText("1 bars / 11.00")).toHaveLength(6);
  });

  it("renders active and related selected candle states", () => {
    useAppStore.setState({
      selectedCandle: {
        ticker: "SOXL",
        timeframe: "4H",
        timestamp: "2024-01-03T14:30:00.000Z"
      }
    });

    render(<ChartGrid4H />);

    const soxl4hChart = screen.getByLabelText("SOXL 4H chart");
    const soxs4hChart = screen.getByLabelText("SOXS 4H chart");

    expect(document.querySelectorAll(".replay-cursor")).toHaveLength(0);
    expect(within(soxl4hChart).getByLabelText("SOXL selected close 12.00")).toBeInTheDocument();
    expect(within(soxs4hChart).getByLabelText("SOXS related selected close 12.00")).toBeInTheDocument();
    expect(soxl4hChart.querySelector(".chart-hit-target.selected")).toBeInTheDocument();
    expect(soxs4hChart.querySelector(".chart-hit-target.selected")).toBeInTheDocument();
    expect(soxl4hChart.querySelector(".selected-candle-marker.active")).toBeInTheDocument();
    expect(soxs4hChart.querySelector(".selected-candle-marker.related")).toBeInTheDocument();
  });

  it("keeps a stable price crosshair while hovering candle hit targets", () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 100,
      bottom: 100,
      left: 0,
      width: 100,
      height: 100,
      toJSON: () => ({})
    });

    render(<ChartGrid4H />);

    const soxlChart = screen.getByLabelText("SOXL 4H chart");
    const priceCandles = within(soxlChart).getByLabelText("Price candles");
    fireEvent.pointerMove(priceCandles, {
      clientX: 44,
      clientY: 52
    });

    expect(soxlChart.querySelector(".price-crosshair")).toBeInTheDocument();

    const hitTargets = soxlChart.querySelectorAll(".chart-hit-target");
    fireEvent.pointerMove(hitTargets[1], {
      clientX: 100,
      clientY: 52
    });

    expect(soxlChart.querySelector(".price-crosshair")).toBeInTheDocument();

    fireEvent.pointerLeave(priceCandles);
    expect(soxlChart.querySelector(".price-crosshair")).not.toBeInTheDocument();

    rectSpy.mockRestore();
  });

  it("keeps selected and hover readouts distinct during review", () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 100,
      bottom: 100,
      left: 0,
      width: 100,
      height: 100,
      toJSON: () => ({})
    });

    useAppStore.setState({
      selectedCandle: {
        ticker: "SOXL",
        timeframe: "4H",
        timestamp: "2024-01-02T14:30:00.000Z"
      }
    });

    render(<ChartGrid4H />);

    const soxlChart = screen.getByLabelText("SOXL 4H chart");
    const priceCandles = within(soxlChart).getByLabelText("Price candles");

    try {
      fireEvent.pointerMove(priceCandles, {
        clientX: 100,
        clientY: 52
      });

      const readouts = within(soxlChart).getByLabelText("SOXL 4H chart readouts");
      expect(within(readouts).getByText("Hover")).toBeInTheDocument();
      expect(within(readouts).getByText(/2024-01-03 O 11.00 H 13.00 L 10.00 C 12.00/)).toBeInTheDocument();
      expect(within(readouts).getByText("Selected")).toBeInTheDocument();
      expect(within(readouts).getByText(/2024-01-02 O 10.00 H 12.00 L 9.00 C 11.00/)).toBeInTheDocument();
      expect(readouts.querySelector(".chart-readout.hover")).toBeInTheDocument();
      expect(readouts.querySelector(".chart-readout.selected")).toBeInTheDocument();
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("syncs indicator crosshairs and readouts to the hovered candle", () => {
    useAppStore.setState({
      chartLayoutMode: "focused",
      activeTimeframe: "4H",
      focusedTicker: "SOXL"
    });

    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 100,
      bottom: 100,
      left: 0,
      width: 100,
      height: 100,
      toJSON: () => ({})
    });

    render(<ChartGrid4H />);

    const soxlChart = screen.getByLabelText("SOXL 4H chart");
    const priceCandles = within(soxlChart).getByLabelText("Price candles");

    try {
      fireEvent.pointerMove(priceCandles, {
        clientX: 100,
        clientY: 52
      });

      const indicatorHeads = Array.from(soxlChart.querySelectorAll(".indicator-pane-head"));

      expect(soxlChart.querySelectorAll(".indicator-crosshair")).toHaveLength(4);
      expect(soxlChart.querySelector(".price-crosshair")).toBeInTheDocument();
      expect(within(soxlChart).getByText("Hover")).toBeInTheDocument();
      expect(within(soxlChart).getByText(/2024-01-03 O 11.00 H 13.00 L 10.00 C 12.00/)).toBeInTheDocument();
      expect(indicatorHeads.map((head) => head.textContent)).toEqual([
        "SMIO 20 20 101.5000",
        "Stoch RSI 7 10 14 1571.0081.00",
        "CM_WVF_V3_Ult 22 20 2 50 0.85 40 14 3-3.000.0000",
        "ATR 14 RMA3.00"
      ]);

      fireEvent.pointerLeave(priceCandles);

      expect(soxlChart.querySelectorAll(".indicator-crosshair")).toHaveLength(0);
      expect(soxlChart.querySelector(".price-crosshair")).not.toBeInTheDocument();
      expect(within(soxlChart).getByText("Selected")).toBeInTheDocument();
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("shares the hovered candle timestamp across grid panels", () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 100,
      bottom: 100,
      left: 0,
      width: 100,
      height: 100,
      toJSON: () => ({})
    });

    render(<ChartGrid4H />);

    const soxlChart = screen.getByLabelText("SOXL 4H chart");
    const priceCandles = within(soxlChart).getByLabelText("Price candles");

    try {
      fireEvent.pointerMove(priceCandles, {
        clientX: 100,
        clientY: 52
      });

      expect(within(screen.getByLabelText("SOXL 4H chart")).getByText("Hover")).toBeInTheDocument();
      expect(within(screen.getByLabelText("SOXS 4H chart")).getByText("Hover")).toBeInTheDocument();
      expect(within(screen.getByLabelText("SOXL 1D chart")).getByText("Hover")).toBeInTheDocument();
      expect(within(screen.getByLabelText("SOXL 2H chart")).getByText("Hover")).toBeInTheDocument();
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("exposes a fit control for resetting the chart view", () => {
    render(<ChartGrid4H />);

    expect(screen.getByRole("button", { name: "Reset SOXL 4H chart view" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset SOXS 4H chart view" })).toBeInTheDocument();
  });

  it("creates a trendline from two candle clicks", async () => {
    useAppStore.setState({
      drawingMode: {
        ticker: "SOXL",
        timeframe: "4H",
        type: "trendline",
        firstAnchor: null
      }
    });

    render(<ChartGrid4H />);
    const soxlChart = screen.getByLabelText("SOXL 4H chart");

    await userEvent.click(
      within(soxlChart).getByTitle("2024-01-02T14:30:00.000Z close 11.00")
    );
    expect(useAppStore.getState().drawingStatus).toBe(
      "Line anchor set on SOXL 4H. Click the second candle."
    );
    await userEvent.click(
      within(soxlChart).getByTitle("2024-01-03T14:30:00.000Z close 12.00")
    );

    expect(useAppStore.getState().createDrawing).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: "SOXL",
        timeframe: "4H",
        type: "trendline",
        anchors: [
          { timestamp: "2024-01-02T14:30:00.000Z", price: 11 },
          { timestamp: "2024-01-03T14:30:00.000Z", price: 12 }
        ]
      })
    );
    expect(useAppStore.getState().selectedDrawingId).toBe("drawing-1");
    expect(useAppStore.getState().drawingStatus).toBe("Created SOXL 4H trendline");
  });

  it("does not create a vertical trendline when both clicks are on the same candle", async () => {
    useAppStore.setState({
      drawingMode: {
        ticker: "SOXL",
        timeframe: "4H",
        type: "trendline",
        firstAnchor: null
      }
    });

    render(<ChartGrid4H />);
    const soxlChart = screen.getByLabelText("SOXL 4H chart");
    const candle = within(soxlChart).getByTitle("2024-01-02T14:30:00.000Z close 11.00");

    await userEvent.click(candle);
    await userEvent.click(candle);

    expect(useAppStore.getState().createDrawing).not.toHaveBeenCalled();
    expect(useAppStore.getState().drawingMode).toEqual({
      ticker: "SOXL",
      timeframe: "4H",
      type: "trendline",
      firstAnchor: { timestamp: "2024-01-02T14:30:00.000Z", price: 11 }
    });
    expect(useAppStore.getState().drawingStatus).toBe(
      "Line anchor reset on SOXL 4H. Click a different candle."
    );
  });

  it("does not render degenerate trendlines with both anchors on the same candle", () => {
    useAppStore.setState({
      drawings: [
        {
          id: "drawing-1",
          sessionId: null,
          ticker: "SOXL",
          timeframe: "4H",
          type: "trendline",
          anchors: [
            { timestamp: "2024-01-02T14:30:00.000Z", price: 11 },
            { timestamp: "2024-01-02T14:30:00.000Z", price: 12 }
          ],
          style: { color: "#f2d35e" },
          slope: null,
          createdAt: "2024-01-02T14:30:00.000Z",
          updatedAt: "2024-01-02T14:30:00.000Z",
          deletedAt: null
        }
      ]
    });

    render(<ChartGrid4H />);

    expect(screen.queryByLabelText("SOXL trendline")).not.toBeInTheDocument();
  });

  it("does not render trendlines that collapse into tiny edge artifacts", () => {
    const manyTimestamps = Array.from({ length: 120 }, (_, index) =>
      new Date(Date.UTC(2024, 0, index + 1, 14, 30, 0)).toISOString()
    );

    useAppStore.setState({
      syncData: {
        ...syncData(),
        timestamps: manyTimestamps,
        series: Object.fromEntries(
          ["SOXL", "SOXS"].map((ticker) => [
            ticker,
            {
              ticker,
              timeframe: "4H",
              candles: manyTimestamps.map((timestamp, index) => ({
                ticker,
                timeframe: "4H",
                timestamp,
                open: 10 + index,
                high: 12 + index,
                low: 9 + index,
                close: 11 + index,
                volume: 1000 + index,
                sourceBarCount: 240
              })),
              indicators: []
            }
          ])
        )
      },
      drawings: [
        {
          id: "drawing-1",
          sessionId: null,
          ticker: "SOXL",
          timeframe: "4H",
          type: "trendline",
          anchors: [
            { timestamp: manyTimestamps[0], price: 11 },
            { timestamp: manyTimestamps[1], price: 12 }
          ],
          style: { color: "#f2d35e" },
          slope: null,
          createdAt: "2024-01-02T14:30:00.000Z",
          updatedAt: "2024-01-02T14:30:00.000Z",
          deletedAt: null
        }
      ]
    });

    render(<ChartGrid4H />);

    expect(screen.queryByLabelText("SOXL trendline")).not.toBeInTheDocument();
  });

  it("does not render saved horizontal level drawings", () => {
    useAppStore.setState({
      drawings: [
        {
          id: "level-1",
          sessionId: null,
          ticker: "SOXL",
          timeframe: "4H",
          type: "horizontal_level",
          anchors: [{ timestamp: "2024-01-03T14:30:00.000Z", price: 12 }],
          style: { color: "#6aa9ff" },
          slope: null,
          createdAt: "2024-01-02T14:30:00.000Z",
          updatedAt: "2024-01-02T14:30:00.000Z",
          deletedAt: null
        }
      ]
    });

    render(<ChartGrid4H />);

    expect(screen.queryByLabelText("SOXL horizontal level")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Drag SOXL horizontal level")).not.toBeInTheDocument();
  });

  it("creates a breakout marker from one candle click", async () => {
    useAppStore.setState({
      drawingMode: {
        ticker: "SOXL",
        timeframe: "4H",
        type: "breakout_marker",
        firstAnchor: null
      }
    });

    render(<ChartGrid4H />);
    const soxlChart = screen.getByLabelText("SOXL 4H chart");

    await userEvent.click(
      within(soxlChart).getByTitle("2024-01-03T14:30:00.000Z close 12.00")
    );

    expect(useAppStore.getState().createDrawing).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: "SOXL",
        timeframe: "4H",
        type: "breakout_marker",
        anchors: [{ timestamp: "2024-01-03T14:30:00.000Z", price: 12 }]
      })
    );
    expect(useAppStore.getState().selectedDrawingId).toBe("drawing-1");
    expect(useAppStore.getState().drawingStatus).toBe("Created SOXL 4H breakout marker");
  });

  it("renders captured labels as chart markers and opens the selected label", async () => {
    useAppStore.setState({
      sessionLabels: [
        {
          id: "label-1",
          sessionId: "session-1",
          timestamp: "2024-01-03T14:30:00.000Z",
          ticker: "SOXL",
          timeframe: "4H",
          labelType: "ENTRY",
          price: 12,
          confidence: 3,
          setupQuality: 4,
          reasonCodes: [],
          notes: null,
          decisionPhase: "at_close",
          captureMode: "regular",
          visibleUntilTimestamp: "2024-01-03T14:30:00.000Z",
          potentialVisualLeakage: true,
          selectedBarIndex: 2,
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
          indicatorSnapshot: {},
          structureSnapshot: {},
          drawingContext: {},
          createdAt: "2024-01-03T14:31:00.000Z",
          updatedAt: "2024-01-03T14:31:00.000Z",
          deletedAt: null
        },
        {
          id: "label-2",
          sessionId: "session-1",
          timestamp: "2024-01-03T14:30:00.000Z",
          ticker: "SOXS",
          timeframe: "2H",
          labelType: "EXIT",
          price: 12,
          confidence: 3,
          setupQuality: 4,
          reasonCodes: [],
          notes: null,
          decisionPhase: "at_close",
          captureMode: "regular",
          visibleUntilTimestamp: "2024-01-03T14:30:00.000Z",
          potentialVisualLeakage: true,
          selectedBarIndex: 2,
          setupId: null,
          tradeId: null,
          parentLabelId: null,
          decisionRole: "exit",
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
          indicatorSnapshot: {},
          structureSnapshot: {},
          drawingContext: {},
          createdAt: "2024-01-03T14:31:00.000Z",
          updatedAt: "2024-01-03T14:31:00.000Z",
          deletedAt: null
        }
      ]
    });

    render(<ChartGrid4H />);

    const soxlChart = screen.getByLabelText("SOXL 4H chart");
    const soxs2hChart = screen.getByLabelText("SOXS 2H chart");
    expect(
      within(soxlChart).getByRole("button", {
        name: "Edit ENTRY label SOXL 12.00 at 2024-01-03T14:30:00.000Z"
      })
    ).toBeInTheDocument();
    expect(
      within(soxs2hChart).getByRole("button", {
        name: "Edit EXIT label SOXS 12.00 at 2024-01-03T14:30:00.000Z"
      })
    ).toBeInTheDocument();

    await userEvent.click(
      within(soxlChart).getByRole("button", {
        name: "Edit ENTRY label SOXL 12.00 at 2024-01-03T14:30:00.000Z"
      })
    );

    expect(useAppStore.getState().selectedCandle).toEqual({
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: "2024-01-03T14:30:00.000Z"
    });
    expect(useAppStore.getState().selectedLabelId).toBe("label-1");
    expect(
      within(soxlChart).getByText(/2024-01-03 O 11.00 H 13.00 L 10.00 C 12.00 Vol 1.0K/)
    ).toBeInTheDocument();
    expect(
      within(soxlChart).getByRole("button", {
        name: "Edit ENTRY label SOXL 12.00 at 2024-01-03T14:30:00.000Z"
      })
    ).toHaveClass("selected");
  });

  it("shows warning and blocker label pin states from QA issues", () => {
    useAppStore.setState({
      sessionLabels: [
        chartLabel({ id: "label-warning", labelType: "ENTRY" }),
        chartLabel({
          id: "label-error",
          timestamp: "2024-01-02T14:30:00.000Z",
          labelType: "EXIT",
          price: 11
        })
      ],
      exportValidationReport: validationReport([
        {
          severity: "warning",
          code: "potential_visual_leakage",
          labelId: "label-warning",
          message: "Regular-mode labels can include visual leakage."
        },
        {
          severity: "error",
          code: "selected_candle_missing",
          labelId: "label-error",
          message: "Selected candle is missing."
        }
      ])
    });

    render(<ChartGrid4H />);

    const soxlChart = screen.getByLabelText("SOXL 4H chart");
    expect(
      within(soxlChart).getByRole("button", {
        name: "Edit ENTRY label SOXL 12.00 at 2024-01-03T14:30:00.000Z"
      })
    ).toHaveClass("warning");
    expect(
      within(soxlChart).getByRole("button", {
        name: "Edit EXIT label SOXL 11.00 at 2024-01-02T14:30:00.000Z"
      })
    ).toHaveClass("error");
    expect(soxlChart.querySelector(".label-anchor-pin.warning")).toBeInTheDocument();
    expect(soxlChart.querySelector(".label-anchor-pin.error")).toBeInTheDocument();
  });

  it("clusters overlapping same-candle labels until a label is selected", async () => {
    useAppStore.setState({
      sessionLabels: [
        chartLabel({ id: "label-1", labelType: "ENTRY" }),
        chartLabel({ id: "label-2", labelType: "SKIP", price: 12.1 })
      ],
      exportValidationReport: validationReport([
        {
          severity: "warning",
          code: "entry_intent_incomplete",
          labelId: "label-2",
          message: "Entry needs intent fields."
        }
      ])
    });

    render(<ChartGrid4H />);

    const soxlChart = screen.getByLabelText("SOXL 4H chart");
    const cluster = within(soxlChart).getByRole("button", {
      name: "Open 2 label cluster SOXL at 2024-01-03T14:30:00.000Z"
    });
    expect(cluster).toHaveClass("cluster", "warning");
    expect(within(soxlChart).queryByRole("button", {
      name: "Edit ENTRY label SOXL 12.00 at 2024-01-03T14:30:00.000Z"
    })).not.toBeInTheDocument();

    await userEvent.click(cluster);

    expect(useAppStore.getState().selectedLabelId).toBe("label-1");
    expect(
      within(soxlChart).getByRole("button", {
        name: "Edit ENTRY label SOXL 12.00 at 2024-01-03T14:30:00.000Z"
      })
    ).toHaveClass("selected");
    expect(
      within(soxlChart).getByRole("button", {
        name: "Edit SKIP label SOXL 12.10 at 2024-01-03T14:30:00.000Z"
      })
    ).toHaveClass("warning");
  });

  it("keeps label markers selectable in focused chart layout", async () => {
    useAppStore.setState({
      chartLayoutMode: "focused",
      activeTimeframe: "4H",
      focusedTicker: "SOXL",
      sessionLabels: [
        {
          id: "label-1",
          sessionId: "session-1",
          timestamp: "2024-01-03T14:30:00.000Z",
          ticker: "SOXL",
          timeframe: "4H",
          labelType: "ENTRY",
          price: 12,
          confidence: 3,
          setupQuality: 4,
          reasonCodes: [],
          notes: null,
          decisionPhase: "at_close",
          captureMode: "regular",
          visibleUntilTimestamp: "2024-01-03T14:30:00.000Z",
          potentialVisualLeakage: true,
          selectedBarIndex: 2,
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
          indicatorSnapshot: {},
          structureSnapshot: {},
          drawingContext: {},
          createdAt: "2024-01-03T14:31:00.000Z",
          updatedAt: "2024-01-03T14:31:00.000Z",
          deletedAt: null
        }
      ]
    });

    render(<ChartGrid4H />);

    const focusedChart = screen.getByLabelText("SOXL 4H chart");
    const labelMarker = within(focusedChart).getByRole("button", {
      name: "Edit ENTRY label SOXL 12.00 at 2024-01-03T14:30:00.000Z"
    });

    expect(focusedChart).toHaveClass("focused", "expanded");
    expect(labelMarker).toBeVisible();

    await userEvent.click(labelMarker);

    expect(useAppStore.getState().selectedLabelId).toBe("label-1");
    expect(labelMarker).toHaveClass("selected");
  });
});
