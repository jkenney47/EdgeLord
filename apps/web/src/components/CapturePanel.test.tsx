import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CapturePanel } from "./CapturePanel";
import { createInitialState, useAppStore } from "../store/useAppStore";
import type { ReviewSummary, Session, SyncChartResponse, TradeEvent } from "../api/client";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function capturedLabel(overrides: Partial<TradeEvent> = {}): TradeEvent {
  return {
    id: "label-1",
    sessionId: "session-1",
    timestamp: "2024-01-02T14:30:00.000Z",
    ticker: "SOXL",
    timeframe: "4H",
    labelType: "ENTRY",
    price: 31.5,
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
    updatedAt: "2024-01-02T14:31:00.000Z",
    deletedAt: null,
    ...overrides
  };
}

function captureSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-1",
    name: "Quick capture",
    startTime: "2024-01-02T14:30:00.000Z",
    endTime: null,
    tickerFocus: null,
    timeframeFocus: "4H",
    notes: null,
    createdAt: "2024-01-02T14:30:00.000Z",
    updatedAt: "2024-01-02T14:30:00.000Z",
    ...overrides
  };
}

async function createAndOpenCapturedLabel() {
  await userEvent.click(screen.getByRole("button", { name: "Entry" }));
  await screen.findByText("ENTRY");
  await userEvent.click(screen.getByRole("button", { name: "Edit ENTRY SOXL 31.50 4H" }));
}

function capturePanelSyncData(): SyncChartResponse {
  return {
    timeframe: "4H",
    tickers: ["SOXL", "SOXS"],
    timestamps: ["2024-01-02T14:30:00.000Z"],
    series: {
      SOXL: {
        ticker: "SOXL",
        timeframe: "4H",
        candles: [
          {
            ticker: "SOXL",
            timeframe: "4H",
            timestamp: "2024-01-02T14:30:00.000Z",
            open: 31,
            high: 32,
            low: 30,
            close: 31.5,
            volume: 1_000_000,
            sourceBarCount: 240
          }
        ],
        indicators: [
          {
            ticker: "SOXL",
            timeframe: "4H",
            timestamp: "2024-01-02T14:30:00.000Z",
            volume: 1_000_000,
            volumeSma20: null,
            ema25: 30,
            sma100: null,
            monthlyVwap: null,
            atr14Rma: null,
            smio: { erg: null, signal: null, oscillator: null },
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
        candles: [
          {
            ticker: "SOXS",
            timeframe: "4H",
            timestamp: "2024-01-02T14:30:00.000Z",
            open: 19,
            high: 20,
            low: 18,
            close: 18.5,
            volume: 750_000,
            sourceBarCount: 240
          }
        ],
        indicators: [
          {
            ticker: "SOXS",
            timeframe: "4H",
            timestamp: "2024-01-02T14:30:00.000Z",
            volume: 750_000,
            volumeSma20: null,
            ema25: 20,
            sma100: null,
            monthlyVwap: null,
            atr14Rma: null,
            smio: { erg: null, signal: null, oscillator: -0.1234 },
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
  };
}

function captureReviewSummary(): ReviewSummary {
  return {
    totalLabels: 1,
    counts: { ENTRY: 1, EXIT: 0, SKIP: 0, INVALID: 0 },
    confidenceDistribution: { "1": 0, "2": 0, "3": 1, "4": 0, "5": 0 },
    setupQualityDistribution: { "1": 0, "2": 0, "3": 1, "4": 0, "5": 0 },
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
        count: 1,
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
  };
}

describe("CapturePanel", () => {
  beforeEach(() => {
    useAppStore.setState({
      ...createInitialState(),
      selectedCandle: {
        ticker: "SOXL",
        timestamp: "2024-01-02T14:30:00.000Z"
      },
      syncData: capturePanelSyncData(),
      activeSession: captureSession(),
      fetchReviewSummary: vi.fn().mockResolvedValue(captureReviewSummary()),
      fetchExportValidationReport: vi.fn().mockResolvedValue({
        status: "pass",
        summary: {
          totalLabels: 1,
          errorCount: 0,
          warningCount: 0,
          labelsByTicker: { SOXL: 1 },
          labelsByTimeframe: { "4H": 1 },
          labelsByLabelType: { ENTRY: 1 },
          labelsByReplayMode: { replay: 1 },
          labelsByDecisionRole: { entry: 1 },
          labelsByBias: { unclear: 1 },
          labelsByTradeDirection: { observe_only: 1 },
          labelsWithMissingPairedContext: 0,
          labelsWithLeakageWarnings: 0,
          labelsWithIncompleteIntent: 0,
          labelsWithSetupId: 0,
          labelsWithTradeId: 0,
          labelsWithOutcomeAvailable: 0,
          labelsByOutcomeStatus: { not_computed: 1 },
          outcomeRuleVersions: {},
          outcomeFieldsExcludedFromDecisionCsv: true
        },
        issues: []
      }),
      createSession: vi.fn().mockResolvedValue(captureSession()),
      listSessions: vi.fn().mockResolvedValue([captureSession()]),
      createTradeEvent: vi.fn().mockResolvedValue(capturedLabel()),
      updateTradeEvent: vi.fn().mockResolvedValue(capturedLabel({ confidence: 5, labelType: "EXIT" })),
      calculateLabelOutcome: vi.fn().mockResolvedValue(
        capturedLabel({
          outcomeAvailable: true,
          outcomeHorizonBars: 10,
          outcomeStatus: "computed",
          outcomeRuleVersion: "outcome_rule_v1"
        })
      ),
      deleteTradeEvent: vi.fn().mockResolvedValue(
        capturedLabel({ deletedAt: "2024-01-02T14:31:00.000Z" })
      ),
      listTradeEvents: vi.fn().mockResolvedValue([capturedLabel()])
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("creates a label for the selected candle", async () => {
    render(<CapturePanel />);

    await userEvent.click(screen.getByRole("button", { name: "Entry" }));

    await waitFor(() => {
      expect(useAppStore.getState().createTradeEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "session-1",
          ticker: "SOXL",
          timestamp: "2024-01-02T14:30:00.000Z",
          timeframe: "4H",
          labelType: "ENTRY",
          price: 31.5,
          confidence: 3,
          setupQuality: 3,
          reasonCodes: [],
          indicatorSnapshot: expect.objectContaining({
            ema25: 30,
            pairedTicker: expect.objectContaining({
              ticker: "SOXS",
              candle: expect.objectContaining({ close: 18.5 }),
              indicator: expect.objectContaining({
                smio: expect.objectContaining({ oscillator: -0.1234 })
              })
            })
          }),
          structureSnapshot: expect.objectContaining({
            recentHigh: 32,
            recentLow: 30,
            distanceToRecentHigh: 0.5,
            distanceToRecentLow: 1.5
          })
        })
      );
      expect(screen.getByText("Created label")).toBeInTheDocument();
      expect(screen.getByText("Created label").closest("[role='status']")).toHaveTextContent(
        "ENTRY SOXL 31.50 4H"
      );
    });
  });

  it("allows first capture to auto-start a quick session", async () => {
    useAppStore.setState({
      activeSession: null
    });

    render(<CapturePanel />);

    expect(screen.getByRole("button", { name: "Entry" })).toBeEnabled();
    expect(screen.getByText("First label starts a Quick capture session.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Entry" }));

    await waitFor(() => {
      expect(useAppStore.getState().createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Quick capture",
          tickerFocus: "SOXL",
          timeframeFocus: "4H"
        })
      );
      expect(useAppStore.getState().createTradeEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "session-1",
          labelType: "ENTRY"
        })
      );
    });
  });

  it("still allows manually starting a quick session from capture", async () => {
    useAppStore.setState({
      activeSession: null
    });

    render(<CapturePanel />);

    await userEvent.click(screen.getByRole("button", { name: "Start Session" }));

    await waitFor(() => {
      expect(useAppStore.getState().createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Quick capture",
          tickerFocus: "SOXL",
          timeframeFocus: "4H"
        })
      );
    });
    expect(screen.getByRole("button", { name: "Entry" })).toBeEnabled();
  });

  it("keeps the narrow compact label controls in one grouped action surface", () => {
    render(<CapturePanel />);

    const actionBar = screen.getByRole("group", { name: "Compact label controls" });
    const decisionLabels = within(actionBar).getByRole("group", { name: "Decision labels" });
    expect(within(decisionLabels).getByRole("button", { name: "Entry" })).toBeEnabled();
    expect(within(decisionLabels).getByRole("button", { name: "Exit" })).toBeEnabled();
    expect(within(decisionLabels).getByRole("button", { name: "Skip" })).toBeEnabled();
    expect(within(decisionLabels).getByRole("button", { name: "Invalid" })).toBeEnabled();
    expect(within(actionBar).getByRole("button", { name: "Confidence 3" })).toHaveClass("active");
    expect(within(actionBar).getByRole("button", { name: "Setup quality 3" })).toHaveClass("active");
    expect(within(actionBar).getByText("Details")).toBeInTheDocument();
  });

  it("captures setup and trade lifecycle metadata with a label", async () => {
    render(<CapturePanel />);

    await userEvent.click(screen.getByText("Details"));
    await userEvent.type(screen.getByLabelText("Setup ID"), "setup-breakout-1");
    await userEvent.type(screen.getByLabelText("Trade ID"), "trade-breakout-1");
    await userEvent.selectOptions(screen.getByLabelText("Role"), "trigger");
    await userEvent.selectOptions(screen.getByLabelText("Bias"), "long");
    await userEvent.selectOptions(screen.getByLabelText("Direction"), "long_ticker");
    await userEvent.click(screen.getByRole("button", { name: "Entry" }));

    await waitFor(() => {
      expect(useAppStore.getState().createTradeEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          setupId: "setup-breakout-1",
          tradeId: "trade-breakout-1",
          parentLabelId: null,
          decisionRole: "trigger",
          bias: "long",
          tradeDirection: "long_ticker"
        })
      );
    });
  });

  it("starts a setup and trade idea without manually typing IDs", async () => {
    render(<CapturePanel />);

    await userEvent.click(screen.getByText("Details"));
    await userEvent.click(screen.getByRole("button", { name: "Start Setup" }));
    expect(screen.getByLabelText("Setup ID")).toHaveValue("setup-1");
    expect(screen.getByLabelText("Role")).toHaveValue("setup_start");

    await userEvent.click(screen.getByRole("button", { name: "Start Trade" }));
    expect(screen.getByLabelText("Setup ID")).toHaveValue("setup-1");
    expect(screen.getByLabelText("Trade ID")).toHaveValue("trade-1");
    expect(screen.getByLabelText("Role")).toHaveValue("trigger");

    await userEvent.selectOptions(screen.getByLabelText("Bias"), "long");
    await userEvent.selectOptions(screen.getByLabelText("Direction"), "long_ticker");
    await userEvent.click(screen.getByRole("button", { name: "Entry" }));

    await waitFor(() => {
      expect(useAppStore.getState().createTradeEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          setupId: "setup-1",
          tradeId: "trade-1",
          parentLabelId: null,
          decisionRole: "trigger",
          bias: "long",
          tradeDirection: "long_ticker"
        })
      );
    });
  });

  it("continues the last setup and trade idea as management", async () => {
    useAppStore.setState({
      sessionLabels: [
        capturedLabel({
          id: "label-entry",
          setupId: "setup-alpha",
          tradeId: "trade-alpha",
          bias: "long",
          tradeDirection: "long_ticker"
        })
      ]
    });
    render(<CapturePanel />);

    await userEvent.click(screen.getByText("Details"));
    await userEvent.click(screen.getByRole("button", { name: "Continue Last" }));
    expect(screen.getByLabelText("Setup ID")).toHaveValue("setup-alpha");
    expect(screen.getByLabelText("Trade ID")).toHaveValue("trade-alpha");
    expect(screen.getByLabelText("Parent Label")).toHaveValue("label-entry");
    expect(screen.getByLabelText("Role")).toHaveValue("management");
    expect(screen.getByLabelText("Bias")).toHaveValue("long");
    expect(screen.getByLabelText("Direction")).toHaveValue("long_ticker");

    await userEvent.click(screen.getByRole("button", { name: "Exit" }));

    await waitFor(() => {
      expect(useAppStore.getState().createTradeEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          labelType: "EXIT",
          setupId: "setup-alpha",
          tradeId: "trade-alpha",
          parentLabelId: "label-entry",
          decisionRole: "management",
          bias: "long",
          tradeDirection: "long_ticker"
        })
      );
    });
  });

  it("links entry, exit, invalidation, and skip decisions from the trade linkage editor", async () => {
    const entryLabel = capturedLabel({
      id: "label-entry",
      setupId: "setup-alpha",
      tradeId: "trade-alpha",
      decisionRole: "entry",
      bias: "long",
      tradeDirection: "long_ticker"
    });
    useAppStore.setState({
      sessionLabels: [entryLabel]
    });
    render(<CapturePanel />);

    await userEvent.click(screen.getByText("Details"));
    const editor = screen.getByRole("group", { name: "Compact label controls" });
    expect(screen.getByRole("region", { name: "Trade linkage editor" })).toHaveTextContent("trade-alpha");
    expect(screen.getByRole("region", { name: "Trade lifecycle cards" })).toHaveTextContent("trade-alpha");
    expect(screen.getByRole("region", { name: "Trade lifecycle cards" })).toHaveTextContent("open");
    expect(screen.getByRole("region", { name: "Trade lifecycle cards" })).toHaveTextContent("Not computed");

    await userEvent.click(screen.getByRole("button", { name: "Attach Exit" }));
    expect(screen.getByLabelText("Setup ID")).toHaveValue("setup-alpha");
    expect(screen.getByLabelText("Trade ID")).toHaveValue("trade-alpha");
    expect(screen.getByLabelText("Parent Label")).toHaveValue("label-entry");
    expect(screen.getByLabelText("Role")).toHaveValue("exit");

    await userEvent.click(within(editor).getByRole("button", { name: "Exit" }));
    await waitFor(() => {
      expect(useAppStore.getState().createTradeEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          labelType: "EXIT",
          setupId: "setup-alpha",
          tradeId: "trade-alpha",
          parentLabelId: "label-entry",
          decisionRole: "exit"
        })
      );
    });
  });

  it("creates entry trades and keeps skips unlinked", async () => {
    render(<CapturePanel />);

    await userEvent.click(screen.getByText("Details"));
    await userEvent.click(screen.getByRole("button", { name: "Entry Trade" }));
    expect(screen.getByLabelText("Setup ID")).toHaveValue("setup-1");
    expect(screen.getByLabelText("Trade ID")).toHaveValue("trade-1");
    expect(screen.getByLabelText("Role")).toHaveValue("entry");

    await userEvent.click(screen.getByRole("button", { name: "Skip Review" }));
    expect(screen.getByLabelText("Trade ID")).toHaveValue("");
    expect(screen.getByLabelText("Parent Label")).toHaveValue("");
    expect(screen.getByLabelText("Role")).toHaveValue("skip");
  });

  it("attaches invalidations to the latest setup without requiring trade linkage", async () => {
    useAppStore.setState({
      sessionLabels: [
        capturedLabel({
          id: "label-setup",
          setupId: "setup-alpha",
          tradeId: null,
          decisionRole: "setup_start",
          bias: "short",
          tradeDirection: "short_ticker"
        })
      ]
    });
    render(<CapturePanel />);

    await userEvent.click(screen.getByText("Details"));
    await userEvent.click(screen.getByRole("button", { name: "Invalidate Setup" }));

    expect(screen.getByLabelText("Setup ID")).toHaveValue("setup-alpha");
    expect(screen.getByLabelText("Trade ID")).toHaveValue("");
    expect(screen.getByLabelText("Parent Label")).toHaveValue("label-setup");
    expect(screen.getByLabelText("Role")).toHaveValue("invalid");
    expect(screen.getByLabelText("Bias")).toHaveValue("short");
    expect(screen.getByLabelText("Direction")).toHaveValue("short_ticker");
  });

  it("shows selected candle indicator and paired ETF context", () => {
    render(<CapturePanel />);

    const context = screen.getByRole("region", { name: "Selected candle context" });
    expect(screen.getByLabelText("Selected candle details")).toHaveTextContent("Selected Candle");
    expect(screen.getByLabelText("Selected candle details")).toHaveTextContent("SOXL · 4H");
    expect(screen.getByLabelText("Selected candle details")).toHaveTextContent("Jan 2, 2024");
    expect(screen.getByLabelText("Selected candle details")).toHaveTextContent("Future-visible");
    expect(screen.getByLabelText("Selected candle details")).toHaveTextContent("Bar 1");
    expect(screen.queryByRole("region", { name: "Dataset trust compact summary" })).not.toBeInTheDocument();
    expect(screen.getByText("Market Context")).toBeInTheDocument();
    expect(context).toHaveTextContent("31.50");
    expect(context).toHaveTextContent("EMA 25");
    expect(context).toHaveTextContent("30.00");
    expect(context).toHaveTextContent("SOXS same candle");
    expect(context).toHaveTextContent("18.50 / SMIO -0.1234");
  });

  it("shows provenance badges for saved labels", () => {
    useAppStore.setState({
      sessionLabels: [
        capturedLabel({
          id: "regular-label",
          captureMode: "regular",
          potentialVisualLeakage: true
        }),
        capturedLabel({
          id: "replay-label",
          captureMode: "replay",
          potentialVisualLeakage: false
        })
      ]
    });

    render(<CapturePanel />);

    const labels = screen.getByLabelText("Captured labels");
    expect(labels).toHaveTextContent("Future-visible");
    expect(labels).toHaveTextContent("Replay-safe");
    expect(screen.queryByRole("region", { name: "Dataset trust compact summary" })).not.toBeInTheDocument();
  });

  it("shows useful session context before a candle is selected", async () => {
    useAppStore.setState({
      selectedCandle: null,
      activeSession: captureSession({ name: "Morning replay" }),
      focusedTicker: "SOXS",
      activeTimeframe: "2H",
      sessionLabels: [
        capturedLabel({ id: "label-1", labelType: "ENTRY", ticker: "SOXL", timeframe: "4H", price: 31.5 }),
        capturedLabel({ id: "label-2", labelType: "EXIT", ticker: "SOXS", timeframe: "2H", price: 18.5 })
      ]
    });

    render(<CapturePanel />);

    const context = screen.getByRole("region", { name: "Selected candle context" });
    expect(context).toHaveTextContent("Target");
    expect(context).toHaveTextContent("SOXS 2H");
    expect(context).toHaveTextContent("Morning replay");
    expect(context).toHaveTextContent("Labels");
    expect(context).toHaveTextContent("2");
    expect(context).toHaveTextContent("Last Label");
    expect(context).toHaveTextContent("EXIT SOXS 18.50 2H");
    expect(screen.getByLabelText("Capture hotkeys")).toHaveTextContent("EEntry");
    expect(screen.getByLabelText("Recent captured labels")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entry" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Edit recent EXIT SOXS 18.50 2H" }));

    expect(useAppStore.getState().selectedLabelId).toBe("label-2");
    expect(screen.getByRole("region", { name: "Edit captured label" })).toBeInTheDocument();
  });

  it("captures nearby drawing context on labels", async () => {
    useAppStore.setState({
      drawings: [
        {
          id: "trendline-1",
          sessionId: null,
          ticker: "SOXL",
          timeframe: "4H",
          type: "trendline",
          anchors: [
            { timestamp: "2024-01-02T14:30:00.000Z", price: 31 },
            { timestamp: "2024-01-03T14:30:00.000Z", price: 33 }
          ],
          style: { color: "#f2d35e" },
          slope: 0,
          createdAt: "2024-01-02T14:30:00.000Z",
          updatedAt: "2024-01-02T14:30:00.000Z",
          deletedAt: null
        },
        {
          id: "level-1",
          sessionId: null,
          ticker: "SOXL",
          timeframe: "4H",
          type: "horizontal_level",
          anchors: [{ timestamp: "2024-01-02T14:30:00.000Z", price: 30 }],
          style: { color: "#6aa9ff" },
          slope: null,
          createdAt: "2024-01-02T14:30:00.000Z",
          updatedAt: "2024-01-02T14:30:00.000Z",
          deletedAt: null
        },
        {
          id: "marker-1",
          sessionId: null,
          ticker: "SOXL",
          timeframe: "4H",
          type: "breakout_marker",
          anchors: [{ timestamp: "2024-01-02T14:30:00.000Z", price: 31.5 }],
          style: { color: "#ff9f43" },
          slope: null,
          createdAt: "2024-01-02T14:30:00.000Z",
          updatedAt: "2024-01-02T14:30:00.000Z",
          deletedAt: null
        }
      ]
    });

    render(<CapturePanel />);

    await userEvent.click(screen.getByRole("button", { name: "Entry" }));

    await waitFor(() => {
      expect(useAppStore.getState().createTradeEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          drawingContext: {
            nearestTrendline: expect.objectContaining({
              id: "trendline-1",
              priceAtTimestamp: 31,
              distance: 0.5
            }),
            nearestLevel: null,
            breakoutMarker: {
              id: "marker-1",
              anchors: [{ timestamp: "2024-01-02T14:30:00.000Z", price: 31.5 }]
            }
          }
        })
      );
    });
  });

  it("supports keyboard labels for fast capture", async () => {
    render(<CapturePanel />);

    await userEvent.keyboard("x");

    await waitFor(() => {
      expect(useAppStore.getState().createTradeEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          labelType: "EXIT"
        })
      );
      expect(screen.getByText("Created label")).toBeInTheDocument();
    });
  });

  it("clears stale success status when keyboard capture fails", async () => {
    useAppStore.setState({
      activeSession: captureSession(),
      labelStatus: "Created label",
      createTradeEvent: vi.fn().mockRejectedValue(new Error("Network failed"))
    });
    render(<CapturePanel />);

    await userEvent.keyboard("x");

    await waitFor(() => {
      expect(screen.queryByText("Created label")).not.toBeInTheDocument();
      expect(screen.getByText("Network failed")).toBeInTheDocument();
    });
  });

  it("shows captured labels for the active session", async () => {
    render(<CapturePanel />);

    await userEvent.click(screen.getByRole("button", { name: "Entry" }));

    await waitFor(() => {
      expect(useAppStore.getState().listTradeEvents).toHaveBeenCalledWith("session-1");
      expect(screen.getByText("ENTRY")).toBeInTheDocument();
      expect(screen.getByText("SOXL")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit ENTRY SOXL 31.50 4H" })).toBeInTheDocument();
    });
  });

  it("keeps capture ready after creating a label instead of opening edit mode", async () => {
    render(<CapturePanel />);

    await userEvent.click(screen.getByRole("button", { name: "Entry" }));

    await screen.findByText("Created label");

    expect(screen.queryByRole("region", { name: "Edit captured label" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entry" })).toBeEnabled();
  });

  it("clears stale status when label editing starts", async () => {
    render(<CapturePanel />);

    await userEvent.click(screen.getByRole("button", { name: "Entry" }));
    await screen.findByText("Created label");
    await userEvent.click(screen.getByRole("button", { name: "Edit ENTRY SOXL 31.50 4H" }));

    expect(screen.queryByText("Created label")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Edit captured label" })).toBeInTheDocument();
  });

  it("opens details when editing a saved label so intent fields are visible", async () => {
    render(<CapturePanel />);

    await createAndOpenCapturedLabel();

    expect(screen.getByLabelText("Setup and trade metadata")).toBeVisible();
    expect(screen.getByLabelText("Label notes")).toBeVisible();
  });

  it("repairs incomplete entry intent from the edit panel", async () => {
    render(<CapturePanel />);

    await createAndOpenCapturedLabel();
    expect(screen.getByRole("region", { name: "QA repair" })).toHaveTextContent(
      "Entry needs setup, bias, and direction"
    );

    await userEvent.click(screen.getByRole("button", { name: "Long Ticker Setup" }));
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(useAppStore.getState().updateTradeEvent).toHaveBeenCalledWith(
        "label-1",
        expect.objectContaining({
          setupId: "setup-1",
          decisionRole: "entry",
          bias: "long",
          tradeDirection: "long_ticker"
        })
      );
    });
  });

  it("repairs incomplete exit linkage from the edit panel", async () => {
    useAppStore.setState({
      sessionLabels: [
        capturedLabel({
          id: "label-entry",
          setupId: "setup-alpha",
          tradeId: "trade-alpha",
          bias: "long",
          tradeDirection: "long_ticker"
        }),
        capturedLabel({
          id: "label-exit",
          labelType: "EXIT",
          price: 32,
          setupId: null,
          tradeId: null,
          parentLabelId: null,
          decisionRole: "exit"
        })
      ]
    });
    render(<CapturePanel />);

    await userEvent.click(screen.getByRole("button", { name: "Edit EXIT SOXL 32.00 4H" }));
    expect(screen.getByRole("region", { name: "QA repair" })).toHaveTextContent("Exit needs linkage");

    await userEvent.click(screen.getByRole("button", { name: "Link Previous Label" }));
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(useAppStore.getState().updateTradeEvent).toHaveBeenCalledWith(
        "label-exit",
        expect.objectContaining({
          setupId: "setup-alpha",
          tradeId: "trade-alpha",
          parentLabelId: "label-entry",
          decisionRole: "exit",
          bias: "long",
          tradeDirection: "long_ticker"
        })
      );
    });
  });

  it("edits a captured label", async () => {
    render(<CapturePanel />);

    await createAndOpenCapturedLabel();
    await userEvent.click(screen.getByRole("button", { name: "Confidence 5" }));
    await userEvent.click(screen.getByRole("button", { name: "Set label type Exit" }));
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(useAppStore.getState().updateTradeEvent).toHaveBeenCalledWith(
        "label-1",
        expect.objectContaining({
          confidence: 5,
          setupQuality: 3,
          labelType: "EXIT"
        })
      );
      expect(useAppStore.getState().listTradeEvents).toHaveBeenCalledWith("session-1");
      expect(screen.getByText("Updated label")).toBeInTheDocument();
    });
  });

  it("keeps edited draft open when save fails", async () => {
    render(<CapturePanel />);

    await createAndOpenCapturedLabel();
    await userEvent.click(screen.getByRole("button", { name: "Set label type Exit" }));
    await userEvent.type(screen.getByLabelText("Label notes"), "Retry this save");
    useAppStore.setState({
      updateTradeEvent: vi.fn().mockRejectedValue(new Error("Save failed"))
    });

    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("ErrorSave failed");
      expect(screen.getByRole("region", { name: "Edit captured label" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Set label type Exit" })).toHaveClass("active");
      expect(screen.getByLabelText("Label notes")).toHaveValue("Retry this save");
    });
  });

  it("recovers after a failed save retry", async () => {
    const updateTradeEvent = vi
      .fn()
      .mockRejectedValueOnce(new Error("Save failed"))
      .mockResolvedValueOnce(capturedLabel({ labelType: "EXIT", notes: "Retry this save" }));
    render(<CapturePanel />);

    await createAndOpenCapturedLabel();
    await userEvent.click(screen.getByRole("button", { name: "Set label type Exit" }));
    await userEvent.type(screen.getByLabelText("Label notes"), "Retry this save");
    useAppStore.setState({ updateTradeEvent });

    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await screen.findByText("Save failed");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(updateTradeEvent).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("Save failed")).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Edit captured label" })).not.toBeInTheDocument();
      expect(screen.getByText("Updated label")).toBeInTheDocument();
    });
  });

  it("round-trips edited reasons and notes without allowing duplicate capture", async () => {
    render(<CapturePanel />);

    await createAndOpenCapturedLabel();
    await userEvent.click(screen.getByLabelText("Trendline break"));
    await userEvent.type(screen.getByLabelText("Label notes"), "Clean breakout through prior level");

    expect(screen.getByRole("button", { name: "Entry" })).toBeDisabled();
    expect(screen.getAllByText("1 reasons + notes").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(useAppStore.getState().updateTradeEvent).toHaveBeenCalledWith(
        "label-1",
        expect.objectContaining({
          reasonCodes: ["trendline_break"],
          notes: "Clean breakout through prior level"
        })
      );
      expect(useAppStore.getState().createTradeEvent).toHaveBeenCalledOnce();
    });
  });

  it("uses label hotkeys and Enter while editing instead of creating a new label", async () => {
    render(<CapturePanel />);

    await createAndOpenCapturedLabel();
    await userEvent.keyboard("x");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(useAppStore.getState().updateTradeEvent).toHaveBeenCalledWith(
        "label-1",
        expect.objectContaining({
          labelType: "EXIT"
        })
      );
      expect(useAppStore.getState().createTradeEvent).toHaveBeenCalledOnce();
      expect(screen.getByText("Updated label")).toBeInTheDocument();
    });
  });

  it("undoes the last captured label with the U hotkey", async () => {
    useAppStore.setState({
      sessionLabels: [capturedLabel()],
      lastCreatedLabelId: "label-1"
    });

    render(<CapturePanel />);

    await userEvent.keyboard("u");

    await waitFor(() => {
      expect(useAppStore.getState().deleteTradeEvent).toHaveBeenCalledWith("label-1");
      expect(screen.getByText("Deleted label")).toBeInTheDocument();
    });
  });

  it("shows save busy state and ignores repeated Enter while saving", async () => {
    render(<CapturePanel />);

    await createAndOpenCapturedLabel();
    const update = deferred<TradeEvent>();
    const updateTradeEvent = vi.fn().mockReturnValue(update.promise);
    useAppStore.setState({ updateTradeEvent });

    await userEvent.keyboard("{Enter}{Enter}");

    await waitFor(() => {
      expect(updateTradeEvent).toHaveBeenCalledOnce();
      expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Delete Label" })).toBeDisabled();
    });

    update.resolve(capturedLabel());
    await screen.findByText("Updated label");
  });

  it("disables new capture buttons while editing a label", async () => {
    render(<CapturePanel />);

    await createAndOpenCapturedLabel();

    expect(screen.getByRole("button", { name: "Entry" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Exit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Confidence 5" })).toBeEnabled();
    expect(useAppStore.getState().createTradeEvent).toHaveBeenCalledOnce();
  });

  it("cancels label editing with Escape", async () => {
    render(<CapturePanel />);

    await userEvent.click(screen.getByRole("button", { name: "Entry" }));
    await screen.findByText("ENTRY");
    await userEvent.click(screen.getByRole("button", { name: "Edit ENTRY SOXL 31.50 4H" }));
    expect(screen.getByRole("region", { name: "Edit captured label" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confidence 5" }));
    await userEvent.click(screen.getByRole("button", { name: "Set label type Exit" }));
    await userEvent.click(screen.getByLabelText("Trendline break"));
    await userEvent.type(screen.getByLabelText("Label notes"), "Should not leak");

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("region", { name: "Edit captured label" })).not.toBeInTheDocument();
    expect(useAppStore.getState().selectedLabelId).toBeNull();
    expect(screen.queryByText("Created label")).not.toBeInTheDocument();
    expect(screen.queryByText("Updated label")).not.toBeInTheDocument();

    await userEvent.keyboard("e");

    await waitFor(() => {
      expect(useAppStore.getState().createTradeEvent).toHaveBeenCalledTimes(2);
      expect(useAppStore.getState().createTradeEvent).toHaveBeenLastCalledWith(
        expect.objectContaining({
          labelType: "ENTRY",
          confidence: 3,
          setupQuality: 3,
          reasonCodes: [],
          notes: null
        })
      );
      expect(screen.getByText("Created label")).toBeInTheDocument();
    });
  });

  it("focuses a captured label when opening it from history", async () => {
    useAppStore.setState({
      selectedCandle: null,
      sessionLabels: [capturedLabel()]
    });

    render(<CapturePanel />);

    const historyButton = screen.getByRole("button", { name: "Edit ENTRY SOXL 31.50 4H" });
    await userEvent.click(historyButton);

    expect(useAppStore.getState().selectedCandle).toEqual({
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: "2024-01-02T14:30:00.000Z"
    });
    expect(historyButton).toHaveClass("selected");
    expect(historyButton).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("region", { name: "Selected candle context" })).toHaveTextContent(
      "31.50"
    );
  });

  it("deletes a captured label", async () => {
    render(<CapturePanel />);

    await createAndOpenCapturedLabel();
    await userEvent.click(screen.getByRole("button", { name: "Delete Label" }));

    await waitFor(() => {
      expect(useAppStore.getState().deleteTradeEvent).toHaveBeenCalledWith("label-1");
      expect(useAppStore.getState().listTradeEvents).toHaveBeenCalledWith("session-1");
      expect(screen.getByText("Deleted label")).toBeInTheDocument();
    });
  });

  it("calculates an outcome for the selected label", async () => {
    render(<CapturePanel />);

    await createAndOpenCapturedLabel();
    await userEvent.click(screen.getByRole("button", { name: "Calculate Outcome" }));

    await waitFor(() => {
      expect(useAppStore.getState().calculateLabelOutcome).toHaveBeenCalledWith("label-1", {
        horizonBars: 10
      });
      expect(useAppStore.getState().listTradeEvents).toHaveBeenCalledWith("session-1");
      expect(screen.getByText("Calculated outcome")).toBeInTheDocument();
    });
  });

  it("shows an error when outcome calculation fails", async () => {
    render(<CapturePanel />);

    await createAndOpenCapturedLabel();
    useAppStore.setState({
      calculateLabelOutcome: vi.fn().mockRejectedValue(new Error("No future candles"))
    });

    await userEvent.click(screen.getByRole("button", { name: "Calculate Outcome" }));

    await waitFor(() => {
      expect(screen.getByText("No future candles")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("ErrorNo future candles");
    });
  });

  it("keeps label editor open when delete fails", async () => {
    render(<CapturePanel />);

    await createAndOpenCapturedLabel();
    useAppStore.setState({
      deleteTradeEvent: vi.fn().mockRejectedValue(new Error("Delete failed"))
    });

    await userEvent.click(screen.getByRole("button", { name: "Delete Label" }));

    await waitFor(() => {
      expect(screen.getByText("Delete failed")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("ErrorDelete failed");
      expect(screen.getByRole("region", { name: "Edit captured label" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Delete Label" })).toBeEnabled();
    });
  });

  it("recovers after a failed delete retry", async () => {
    const deleteTradeEvent = vi
      .fn()
      .mockRejectedValueOnce(new Error("Delete failed"))
      .mockResolvedValueOnce(capturedLabel({ deletedAt: "2024-01-02T14:31:00.000Z" }));
    render(<CapturePanel />);

    await createAndOpenCapturedLabel();
    useAppStore.setState({ deleteTradeEvent });

    await userEvent.click(screen.getByRole("button", { name: "Delete Label" }));
    await screen.findByText("Delete failed");
    await userEvent.click(screen.getByRole("button", { name: "Delete Label" }));

    await waitFor(() => {
      expect(deleteTradeEvent).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("Delete failed")).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Edit captured label" })).not.toBeInTheDocument();
      expect(screen.getByText("Deleted label")).toBeInTheDocument();
    });
  });

  it("shows delete busy state and ignores repeated delete clicks", async () => {
    render(<CapturePanel />);

    await createAndOpenCapturedLabel();
    const deleted = deferred<TradeEvent>();
    const deleteTradeEvent = vi.fn().mockReturnValue(deleted.promise);
    useAppStore.setState({ deleteTradeEvent });

    await userEvent.click(screen.getByRole("button", { name: "Delete Label" }));

    await waitFor(() => {
      expect(deleteTradeEvent).toHaveBeenCalledOnce();
      expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
    });
    await userEvent.click(screen.getByRole("button", { name: "Deleting..." }));
    expect(deleteTradeEvent).toHaveBeenCalledOnce();

    deleted.resolve(capturedLabel({ deletedAt: "2024-01-02T14:31:00.000Z" }));
    await screen.findByText("Deleted label");
  });
});
