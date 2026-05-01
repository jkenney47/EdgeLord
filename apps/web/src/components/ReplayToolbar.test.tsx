import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReplayToolbar } from "./ReplayToolbar";
import { createInitialState, useAppStore } from "../store/useAppStore";
import type { ExportValidationReport, Session, SyncChartResponse, TradeEvent } from "../api/client";

function syncData(): SyncChartResponse {
  const timestamps = [
    "2024-01-02T14:30:00.000Z",
    "2024-01-03T14:30:00.000Z",
    "2024-01-05T14:30:00.000Z"
  ];

  return {
    timeframe: "4H",
    tickers: ["SOXL", "SOXS"],
    timestamps,
    series: Object.fromEntries(
      ["SOXL", "SOXS"].map((ticker) => [
        ticker,
        {
          ticker,
          timeframe: "4H",
          candles: timestamps.map((timestamp, index) => ({
            ticker,
            timeframe: "4H",
            timestamp,
            open: 10 + index,
            high: 11 + index,
            low: 9 + index,
            close: 10.5 + index,
            volume: 1000 + index,
            sourceBarCount: 240
          })),
          indicators: []
        }
      ])
    ),
    warnings: []
  };
}

const activeSession: Session = {
  id: "session-1",
  name: "Replay",
  startTime: "2024-01-02T14:30:00.000Z",
  endTime: null,
  tickerFocus: "SOXL",
  timeframeFocus: "4H",
  notes: null,
  createdAt: "2024-01-02T14:30:00.000Z",
  updatedAt: "2024-01-02T14:30:00.000Z"
};

const tradeEvent: TradeEvent = {
  id: "event-1",
  sessionId: activeSession.id,
  timestamp: "2024-01-02T14:30:00.000Z",
  ticker: "SOXL",
  timeframe: "4H",
  labelType: "ENTRY",
  price: 42,
  confidence: 3,
  setupQuality: 3,
  reasonCodes: [],
  notes: null,
  decisionPhase: "at_close",
  captureMode: "regular",
  visibleUntilTimestamp: "2024-01-02T14:30:00.000Z",
  potentialVisualLeakage: true,
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
  indicatorSnapshot: {},
  structureSnapshot: {},
  drawingContext: {},
  createdAt: "2024-01-02T14:30:00.000Z",
  updatedAt: "2024-01-02T14:30:00.000Z",
  deletedAt: null
};

function exportValidationReport(
  overrides: Omit<Partial<ExportValidationReport>, "summary"> & {
    summary?: Partial<ExportValidationReport["summary"]>;
  } = {}
): ExportValidationReport {
  const base: ExportValidationReport = {
    status: "warning",
    summary: {
      totalLabels: 1,
      errorCount: 0,
      warningCount: 2,
      labelsByTicker: { SOXL: 1 },
      labelsByTimeframe: { "4H": 1 },
      labelsByLabelType: { ENTRY: 1 },
      labelsByReplayMode: { regular: 1 },
      labelsByDecisionRole: { entry: 1 },
      labelsByBias: { unclear: 1 },
      labelsByTradeDirection: { observe_only: 1 },
      labelsWithMissingPairedContext: 0,
      labelsWithLeakageWarnings: 1,
      labelsWithIncompleteIntent: 1,
      labelsWithSetupId: 0,
      labelsWithTradeId: 0,
      labelsWithOutcomeAvailable: 0,
      labelsByOutcomeStatus: { not_computed: 1 },
      outcomeRuleVersions: {},
      outcomeFieldsExcludedFromDecisionCsv: true
    },
    issues: [],
    manifest: {
      schemaVersion: "trade_event_v1",
      exportVersion: "export_v1",
      indicatorCalcVersion: "indicator_calc_v1",
      structureCalcVersion: "structure_calc_v1",
      exportedAt: "2026-04-30T11:00:00.000Z",
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
      filters: {
        sessionId: "session-1"
      },
      qa: {
        status: "warning",
        blockers: 0,
        warnings: 2
      },
      includedLabelTypes: { ENTRY: 1 },
      rowCount: 1
    }
  };

  return {
    ...base,
    ...overrides,
    summary: {
      ...base.summary,
      ...overrides.summary
    },
    manifest: overrides.manifest === undefined ? base.manifest : overrides.manifest
  };
}

describe("ReplayToolbar", () => {
  beforeEach(() => {
    useAppStore.setState({
      ...createInitialState(),
      importMarketData: vi.fn(),
      fetchSynchronizedChartData: vi.fn().mockResolvedValue({
        timeframe: "2H",
        tickers: ["SOXL", "SOXS"],
        timestamps: [],
        series: {}
      }),
      listDrawings: vi.fn().mockResolvedValue([])
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("runs manual import from the toolbar", async () => {
    const runImport = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ runImport });

    render(<ReplayToolbar />);

    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(runImport).toHaveBeenCalledOnce();
  });

  it("lets the user choose import range and shows data coverage gaps", async () => {
    const runImport = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({
      runImport,
      importStartDate: "2024-01-01",
      importEndDate: "2026-04-28",
      importBaseTimeframe: "1Min",
      dataCoverage: {
        tickers: ["SOXL", "SOXS"],
        timeframes: ["1D", "4H", "2H"],
        summaries: [
          {
            ticker: "SOXL",
            timeframe: "4H",
            barCount: 263,
            firstTimestamp: "2024-01-02T14:30:00.000Z",
            lastTimestamp: "2026-04-24T13:30:00.000Z",
            gapCount: 1,
            largestGapDays: 465
          }
        ],
        gaps: [
          {
            ticker: "SOXL",
            timeframe: "4H",
            previousTimestamp: "2024-01-19T14:30:00.000Z",
            timestamp: "2025-04-28T13:30:00.000Z",
            gapDays: 465
          }
        ]
      }
    });

    render(<ReplayToolbar />);

    expect(screen.getByLabelText("Data import controls")).toHaveTextContent("Coverage gaps 1");
    expect(screen.getByLabelText("Data coverage status")).toHaveTextContent("2024-01-02 to 2026-04-24");

    await userEvent.clear(screen.getByLabelText("Import start date"));
    await userEvent.type(screen.getByLabelText("Import start date"), "2023-01-01");
    await userEvent.clear(screen.getByLabelText("Import end date"));
    await userEvent.type(screen.getByLabelText("Import end date"), "2026-04-28");
    await userEvent.selectOptions(screen.getByLabelText("Import base timeframe"), "5Min");
    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(useAppStore.getState()).toMatchObject({
      importStartDate: "2023-01-01",
      importEndDate: "2026-04-28",
      importBaseTimeframe: "5Min"
    });
    expect(runImport).toHaveBeenCalledOnce();
  });

  it("groups toolbar controls into market, replay, navigation, session, and export zones", () => {
    render(<ReplayToolbar />);

    expect(screen.getByLabelText("Market controls")).toHaveTextContent("Market");
    expect(screen.getByLabelText("Replay mode controls")).toHaveTextContent("Replay");
    expect(screen.getByLabelText("Candle navigation controls")).toHaveTextContent("Nav");
    expect(screen.getByLabelText("Session status")).toHaveTextContent("Session");
    expect(screen.getByLabelText("Export controls")).toHaveTextContent("Export");
    expect(screen.getByLabelText("Export controls")).toHaveClass("export-toolbar-group");
  });

  it("loads the full chart grid from the toolbar", async () => {
    const loadChartData = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ activeTimeframe: "2H", loadChartData });

    render(<ReplayToolbar />);

    expect(screen.getByRole("button", { name: "Load Charts" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Load Charts" }));

    expect(loadChartData).toHaveBeenCalledOnce();
  });

  it("does not render dead topbar actions", () => {
    useAppStore.setState({
      lastImportResult: {
        importRunId: "run-1",
        provider: "alpaca",
        tickers: ["SOXL", "SOXS"],
        baseBarsInserted: 480,
        aggregatedBarsInserted: 2,
        alignedTimestamps: ["2024-01-02T14:30:00.000Z"],
        warnings: []
      }
    });

    render(<ReplayToolbar />);

    expect(screen.queryByRole("button", { name: "New Session" })).not.toBeInTheDocument();
    expect(screen.queryByText("2 bars")).not.toBeInTheDocument();
  });

  it("shows scoped import success and failure status in the data controls", () => {
    useAppStore.setState({
      lastImportResult: {
        importRunId: "run-1",
        provider: "alpaca",
        tickers: ["SOXL", "SOXS"],
        baseBarsInserted: 480,
        aggregatedBarsInserted: 12,
        alignedTimestamps: ["2024-01-02T14:30:00.000Z"],
        warnings: ["SOXL 5Min returned sparse data"]
      }
    });

    const { rerender } = render(<ReplayToolbar />);

    expect(screen.getByLabelText("Import status")).toHaveTextContent(
      "Imported 480 source / 12 chart bars, 1 warnings"
    );

    useAppStore.setState({
      lastImportResult: null,
      importError: "Import failed"
    });
    rerender(<ReplayToolbar />);

    expect(screen.getByLabelText("Import status")).toHaveTextContent("Import failed: Import failed");
  });

  it("builds session-scoped export links in the toolbar", () => {
    useAppStore.setState({
      activeSession,
      sessionLabels: [tradeEvent],
      exportValidationReport: exportValidationReport()
    });

    render(<ReplayToolbar />);

    expect(screen.getByLabelText("Export controls")).toHaveTextContent("Session 1 label");
    expect(screen.getByLabelText("Export preview")).toHaveTextContent("Warnings 2");
    expect(screen.queryByLabelText("Export manifest preview")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Export label types")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Export outcome inclusion")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CSV" })).toHaveAttribute(
      "href",
      "http://127.0.0.1:4317/export/trade-events?format=csv&sessionId=session-1"
    );
    expect(screen.getByRole("link", { name: "JSON" })).toHaveAttribute(
      "href",
      "http://127.0.0.1:4317/export/trade-events?format=json&sessionId=session-1"
    );
  });

  it("enables all-label exports from the review summary when no session is active", () => {
    useAppStore.setState({
      exportValidationReport: exportValidationReport({
        summary: {
          totalLabels: 4,
          labelsByLabelType: { ENTRY: 2, EXIT: 1, SKIP: 1 },
          warningCount: 0
        },
        status: "pass",
        manifest: {
          ...exportValidationReport().manifest!,
          filters: { sessionId: null },
          includedLabelTypes: { ENTRY: 2, EXIT: 1, SKIP: 1 },
          qa: { status: "pass", blockers: 0, warnings: 0 },
          rowCount: 4
        }
      }),
      reviewSummary: {
        totalLabels: 4,
        counts: {
          ENTRY: 2,
          EXIT: 1,
          SKIP: 1,
          INVALID: 0
        },
        confidenceDistribution: {},
        setupQualityDistribution: {},
        pairedTrades: {
          count: 0,
          wins: 0,
          losses: 0,
          winRate: null,
          averageReturnPercent: null,
          pairs: []
        },
        conditionSummary: {
          entryReasonCodes: {},
          profitableReasonCodes: {},
          losingReasonCodes: {},
          skippedReasonCodes: {},
          invalidReasonCodes: {},
          entriesWithBreakoutMarker: 0,
          entriesNearTrendline: 0,
          entriesNearLevel: 0
        },
        indicatorAverages: {
          entries: {
            count: 0,
            smioOscillator: null,
            stochK: null,
            stochD: null,
            atr14Rma: null,
            ema25DistancePercent: null
          },
          profitableEntries: {
            count: 0,
            smioOscillator: null,
            stochK: null,
            stochD: null,
            atr14Rma: null,
            ema25DistancePercent: null
          },
          losingEntries: {
            count: 0,
            smioOscillator: null,
            stochK: null,
            stochD: null,
            atr14Rma: null,
            ema25DistancePercent: null
          },
          skipped: {
            count: 0,
            smioOscillator: null,
            stochK: null,
            stochD: null,
            atr14Rma: null,
            ema25DistancePercent: null
          }
        },
        lossClusters: {
          reasonCodes: {},
          worstPairs: []
        }
      }
    });

    render(<ReplayToolbar />);

    expect(screen.getByText("All 4 labels")).toBeInTheDocument();
    expect(screen.getByLabelText("Export preview")).toHaveTextContent("Ready");
    expect(screen.queryByLabelText("Export label types")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CSV" })).toHaveAttribute(
      "aria-disabled",
      "false"
    );
    expect(screen.getByRole("link", { name: "CSV" })).toHaveAttribute(
      "href",
      "http://127.0.0.1:4317/export/trade-events?format=csv"
    );
    expect(screen.getByRole("link", { name: "JSON" })).toHaveAttribute(
      "href",
      "http://127.0.0.1:4317/export/trade-events?format=json"
    );
  });

  it("disables toolbar export links when there are no labels loaded", () => {
    render(<ReplayToolbar />);

    expect(screen.getByRole("link", { name: "CSV" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "JSON" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "CSV" })).not.toHaveAttribute("href");
    expect(screen.getByRole("link", { name: "JSON" })).not.toHaveAttribute("href");
    expect(screen.getByText("All 0 labels")).toBeInTheDocument();
    expect(screen.getByLabelText("Export preview")).toHaveTextContent("No rows");
  });

  it("blocks toolbar export links when validation has blockers", () => {
    useAppStore.setState({
      activeSession,
      sessionLabels: [tradeEvent],
      exportValidationReport: exportValidationReport({
        status: "fail",
        summary: {
          errorCount: 2,
          warningCount: 1
        },
        manifest: {
          ...exportValidationReport().manifest!,
          qa: { status: "fail", blockers: 2, warnings: 1 }
        }
      })
    });

    render(<ReplayToolbar />);

    expect(screen.getByLabelText("Export preview")).toHaveTextContent("Blocked 2");
    expect(screen.getByRole("link", { name: "CSV" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "JSON" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "CSV" })).not.toHaveAttribute("href");
    expect(screen.getByRole("link", { name: "JSON" })).not.toHaveAttribute("href");
  });

  it("shows the focused layout scope when the chart grid is filtered", () => {
    useAppStore.setState({
      chartLayoutMode: "focused",
      activeTimeframe: "2H",
      focusedTicker: "SOXS"
    });

    render(<ReplayToolbar />);

    expect(screen.getByLabelText("Focused layout: SOXS 2H")).toBeInTheDocument();
  });

  it("shows chart data warnings from loaded timeframes", () => {
    useAppStore.setState({
      syncDataByTimeframe: {
        "2H": {
          ...syncData(),
          timeframe: "2H",
          warnings: [
            {
              code: "large_price_discontinuity",
              severity: "warning",
              classification: "possible_bad_source_data",
              ticker: "SOXS",
              timeframe: "2H",
              timestamp: "2024-03-01T16:30:00.000Z",
              previousTimestamp: "2024-03-01T14:30:00.000Z",
              closeToCloseReturnPercent: -40,
              openGapPercent: -43.33,
              message: "SOXS 2H has a large discontinuity."
            }
          ]
        }
      }
    });

    render(<ReplayToolbar />);

    expect(screen.getByText("Data warnings 1")).toBeInTheDocument();
  });

  it("shows chart data review count separately from actual data warnings", () => {
    useAppStore.setState({
      syncDataByTimeframe: {
        "2H": {
          ...syncData(),
          timeframe: "2H",
          warnings: [
            {
              code: "large_price_discontinuity",
              severity: "review",
              classification: "leveraged_etf_volatility",
              ticker: "SOXL",
              timeframe: "2H",
              timestamp: "2025-04-09T17:30:00.000Z",
              previousTimestamp: "2025-04-09T15:30:00.000Z",
              closeToCloseReturnPercent: 34,
              openGapPercent: 0.2,
              message: "SOXL 2H has a large leveraged ETF move."
            },
            {
              code: "large_price_discontinuity",
              severity: "review",
              classification: "session_gap",
              ticker: "SOXS",
              timeframe: "2H",
              timestamp: "2026-04-08T13:30:00.000Z",
              previousTimestamp: "2026-04-07T17:30:00.000Z",
              closeToCloseReturnPercent: 20,
              openGapPercent: 21,
              message: "SOXS 2H has a large session gap."
            }
          ]
        }
      }
    });

    render(<ReplayToolbar />);

    expect(screen.getByText("Data review 2")).toBeInTheDocument();
    expect(screen.queryByText("Data warnings 2")).not.toBeInTheDocument();
  });

  it("shows coverage loading state instead of an empty coverage state while charts load", () => {
    useAppStore.setState({
      isLoadingChartData: true,
      dataCoverage: null
    });

    render(<ReplayToolbar />);

    expect(screen.getByText("Loading coverage")).toBeInTheDocument();
    expect(screen.queryByText("No coverage loaded")).not.toBeInTheDocument();
  });

  it("sets a replay start date from the toolbar", async () => {
    useAppStore.setState({
      syncData: syncData()
    });

    render(<ReplayToolbar />);

    await userEvent.type(screen.getByLabelText("Replay start date"), "2024-01-04");

    expect(useAppStore.getState()).toMatchObject({
      mode: "replay",
      replayIndex: 2,
      replayStartDate: "2024-01-04",
      replayDateInput: "2024-01-04",
      replayDateError: null,
      selectedCandle: {
        ticker: "SOXL",
        timestamp: "2024-01-05T14:30:00.000Z"
      }
    });
    expect(screen.getByText("Replay hidden after 2024-01-05")).toBeInTheDocument();
  });

  it("accepts slash-formatted replay dates and stores a canonical boundary", async () => {
    useAppStore.setState({
      syncData: syncData()
    });

    render(<ReplayToolbar />);

    await userEvent.type(screen.getByLabelText("Replay start date"), "01/04/2024");

    expect(useAppStore.getState()).toMatchObject({
      mode: "replay",
      replayIndex: 2,
      replayStartDate: "2024-01-04",
      replayDateInput: "01/04/2024",
      replayDateError: null
    });
  });

  it("shows replay date errors without moving the boundary", async () => {
    useAppStore.setState({
      mode: "regular",
      replayIndex: 1,
      replayStartDate: "2024-01-03",
      replayDateInput: "2024-01-03",
      selectedCandle: {
        ticker: "SOXL",
        timeframe: "4H",
        timestamp: "2024-01-03T14:30:00.000Z"
      },
      syncData: syncData()
    });

    render(<ReplayToolbar />);

    fireEvent.change(screen.getByLabelText("Replay start date"), {
      target: { value: "2024-13-01" }
    });

    expect(screen.getByText("Enter a valid date as YYYY-MM-DD or MM/DD/YYYY.")).toBeInTheDocument();
    expect(screen.getByLabelText("Replay start date")).toHaveAttribute("aria-invalid", "true");
    expect(useAppStore.getState()).toMatchObject({
      mode: "regular",
      replayIndex: 1,
      replayStartDate: "2024-01-03",
      replayDateInput: "2024-13-01",
      selectedCandle: {
        timestamp: "2024-01-03T14:30:00.000Z"
      }
    });
  });

  it("rejects replay dates after the dataset instead of jumping to the last candle", async () => {
    useAppStore.setState({
      replayIndex: 0,
      syncData: syncData()
    });

    render(<ReplayToolbar />);

    await userEvent.type(screen.getByLabelText("Replay start date"), "2024-12-31");

    expect(screen.getByText("No candle exists on or after that replay start date.")).toBeInTheDocument();
    expect(useAppStore.getState()).toMatchObject({
      replayIndex: 0,
      replayStartDate: "",
      replayDateInput: "2024-12-31",
      selectedCandle: null
    });
  });

  it("shows whether replay is hiding future bars", async () => {
    useAppStore.setState({
      replayIndex: 1,
      syncData: syncData()
    });

    render(<ReplayToolbar />);

    expect(screen.getByText("Regular: all bars")).toBeInTheDocument();
    expect(screen.getByText("Regular mode: all bars")).toBeInTheDocument();
    expect(screen.getByText("3 / 3")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Replay" }));

    expect(screen.getByText("Replay: future hidden")).toBeInTheDocument();
    expect(screen.getByText("Replay hidden after 2024-01-03")).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("plays replay forward on the configured interval", async () => {
    vi.useFakeTimers();
    useAppStore.setState({
      mode: "replay",
      replayIndex: 0,
      replaySpeedMs: 250,
      syncData: syncData()
    });

    render(<ReplayToolbar />);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(useAppStore.getState().replayIndex).toBe(1);
    expect(useAppStore.getState().selectedCandle).toEqual({
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: "2024-01-03T14:30:00.000Z"
    });
  });

  it("toggles replay playback with the space key", async () => {
    useAppStore.setState({
      mode: "replay",
      replayIndex: 0,
      syncData: syncData()
    });

    render(<ReplayToolbar />);

    await userEvent.keyboard(" ");
    expect(useAppStore.getState().isReplayPlaying).toBe(true);

    await userEvent.keyboard(" ");
    expect(useAppStore.getState().isReplayPlaying).toBe(false);
  });

  it("moves selected candles from toolbar buttons and arrow keys", async () => {
    useAppStore.setState({
      syncData: syncData(),
      selectedCandle: {
        ticker: "SOXL",
        timestamp: "2024-01-03T14:30:00.000Z"
      }
    });

    render(<ReplayToolbar />);

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(useAppStore.getState().selectedCandle).toEqual({
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: "2024-01-05T14:30:00.000Z"
    });

    await userEvent.keyboard("{ArrowLeft}");
    expect(useAppStore.getState().selectedCandle).toEqual({
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: "2024-01-03T14:30:00.000Z"
    });
  });

  it("moves labels and QA issues from keyboard brackets", () => {
    const focusAdjacentLabel = vi.fn().mockResolvedValue(undefined);
    const focusNextValidationIssue = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({
      focusAdjacentLabel,
      focusNextValidationIssue
    });

    render(<ReplayToolbar />);

    fireEvent.keyDown(window, { key: "]" });
    fireEvent.keyDown(window, { key: "[" });
    fireEvent.keyDown(window, { key: "}", shiftKey: true });
    fireEvent.keyDown(window, { key: "{", shiftKey: true });

    expect(focusAdjacentLabel).toHaveBeenNthCalledWith(1, 1);
    expect(focusAdjacentLabel).toHaveBeenNthCalledWith(2, -1);
    expect(focusNextValidationIssue).toHaveBeenNthCalledWith(1, 1);
    expect(focusNextValidationIssue).toHaveBeenNthCalledWith(2, -1);
  });

  it("does not use bracket navigation while typing in toolbar fields", () => {
    const focusAdjacentLabel = vi.fn().mockResolvedValue(undefined);
    const focusNextValidationIssue = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({
      focusAdjacentLabel,
      focusNextValidationIssue
    });

    render(<ReplayToolbar />);

    fireEvent.keyDown(screen.getByLabelText("Import start date"), { key: "]" });
    fireEvent.keyDown(screen.getByLabelText("Import start date"), { key: "}", shiftKey: true });

    expect(focusAdjacentLabel).not.toHaveBeenCalled();
    expect(focusNextValidationIssue).not.toHaveBeenCalled();
  });

  it("starts arrow-key review from the focused chart when no candle is selected", async () => {
    useAppStore.setState({
      syncData: syncData(),
      focusedTicker: "SOXS",
      selectedCandle: null
    });

    render(<ReplayToolbar />);

    await userEvent.keyboard("{ArrowLeft}");

    expect(useAppStore.getState().selectedCandle).toEqual({
      ticker: "SOXS",
      timeframe: "4H",
      timestamp: "2024-01-03T14:30:00.000Z"
    });
  });
});
