import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewPanel } from "./ReviewPanel";
import { createInitialState, useAppStore } from "../store/useAppStore";
import type { SyncChartResponse, TradeEvent } from "../api/client";

function reviewLabel(overrides: Partial<TradeEvent> = {}): TradeEvent {
  return {
    id: "label-1",
    sessionId: "session-1",
    timestamp: "2024-01-02T14:30:00.000Z",
    ticker: "SOXL",
    timeframe: "4H",
    labelType: "ENTRY",
    price: 42.5,
    confidence: 4,
    setupQuality: 5,
    reasonCodes: ["trendline_break"],
    notes: null,
    decisionPhase: "at_close",
    captureMode: "replay",
    visibleUntilTimestamp: "2024-01-02T14:30:00.000Z",
    potentialVisualLeakage: false,
    selectedBarIndex: 12,
    setupId: "setup-1",
    tradeId: "trade-1",
    parentLabelId: null,
    decisionRole: "entry",
    bias: "long",
    marketBias: "bullish_semis",
    tradeDirection: "long_ticker",
    instrumentRole: "primary",
    pairedTickerRole: "confirmation",
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
    createdAt: "2024-01-02T14:31:00.000Z",
    updatedAt: "2024-01-02T14:31:00.000Z",
    deletedAt: null,
    ...overrides
  };
}

function syncData(overrides: Partial<SyncChartResponse> = {}): SyncChartResponse {
  return {
    timeframe: "4H",
    tickers: ["SOXL", "SOXS"],
    timestamps: [],
    series: {},
    warnings: [],
    ...overrides
  };
}

describe("ReviewPanel", () => {
  beforeEach(() => {
    useAppStore.setState({
      ...createInitialState(),
      activeSession: {
        id: "session-1",
        name: "Quick capture",
        startTime: "2024-01-02T14:30:00.000Z",
        endTime: null,
        tickerFocus: "SOXL",
        timeframeFocus: "4H",
        notes: null,
        createdAt: "2024-01-02T14:30:00.000Z",
        updatedAt: "2024-01-02T14:30:00.000Z"
      },
      sessionLabels: [reviewLabel()],
      syncDataByTimeframe: {
        "4H": syncData({
          warnings: [
            {
              code: "large_price_discontinuity",
              severity: "review",
              classification: "leveraged_etf_volatility",
              ticker: "SOXL",
              timeframe: "4H",
              timestamp: "2025-04-09T13:30:00.000Z",
              previousTimestamp: "2025-04-08T13:30:00.000Z",
              closeToCloseReturnPercent: 55.59,
              openGapPercent: 2.66,
              message: "SOXL 4H classified as leveraged ETF volatility."
            },
            {
              code: "large_price_discontinuity",
              severity: "review",
              classification: "session_gap",
              ticker: "SOXS",
              timeframe: "4H",
              timestamp: "2025-05-12T13:30:00.000Z",
              previousTimestamp: "2025-05-09T13:30:00.000Z",
              closeToCloseReturnPercent: -23.92,
              openGapPercent: -20.65,
              message: "SOXS 4H classified as session gap."
            }
          ]
        })
      },
      focusLabel: vi.fn().mockResolvedValue(undefined),
      listTradeEvents: vi.fn().mockResolvedValue([reviewLabel()]),
      fetchReviewSummary: vi.fn().mockResolvedValue({
        totalLabels: 3,
        counts: { ENTRY: 1, EXIT: 1, SKIP: 1, INVALID: 0 },
        confidenceDistribution: { "1": 0, "2": 1, "3": 1, "4": 1, "5": 0 },
        setupQualityDistribution: { "1": 0, "2": 0, "3": 2, "4": 0, "5": 1 },
        pairedTrades: {
          count: 1,
          wins: 1,
          losses: 0,
          winRate: 1,
          averageReturnPercent: 10,
          pairs: []
        },
        conditionSummary: {
          entryReasonCodes: { trendline_break: 1 },
          profitableReasonCodes: { trendline_break: 1 },
          losingReasonCodes: {},
          skippedReasonCodes: { ema_alignment: 1 },
          invalidReasonCodes: {},
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
            ema25DistancePercent: 4.5
          },
          profitableEntries: {
            count: 1,
            smioOscillator: 0.25,
            stochK: 72,
            stochD: 65,
            atr14Rma: 3.2,
            ema25DistancePercent: 4.5
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
            count: 1,
            smioOscillator: -0.2,
            stochK: 31,
            stochD: 35,
            atr14Rma: 2.1,
            ema25DistancePercent: -1.2
          }
        },
        lossClusters: {
          reasonCodes: {},
          worstPairs: []
        }
      }),
      fetchExportValidationReport: vi.fn().mockResolvedValue({
        status: "warning",
        summary: {
          totalLabels: 3,
          errorCount: 0,
          warningCount: 2,
          labelsByTicker: { SOXL: 3 },
          labelsByTimeframe: { "4H": 3 },
          labelsByLabelType: { ENTRY: 1, EXIT: 1, SKIP: 1 },
          labelsByReplayMode: { replay: 2, regular: 1 },
          labelsByDecisionRole: { entry: 1, exit: 1, skip: 1 },
          labelsByBias: { long: 2, unclear: 1 },
          labelsByTradeDirection: { long_ticker: 2, observe_only: 1 },
          labelsWithMissingPairedContext: 1,
          labelsWithLeakageWarnings: 1,
          labelsWithIncompleteIntent: 0,
          labelsWithSetupId: 2,
          labelsWithTradeId: 1,
          labelsWithOutcomeAvailable: 1,
          labelsByOutcomeStatus: { computed: 1, not_computed: 2 },
          outcomeRuleVersions: { outcome_rule_v1: 1 },
          outcomeFieldsExcludedFromDecisionCsv: true
        },
        issues: [
          {
            severity: "warning",
            code: "missing_paired_context",
            labelId: "label-1",
            message: "Paired ETF context is missing or incomplete."
          },
          {
            severity: "warning",
            code: "entry_intent_incomplete",
            labelId: "label-1",
            message: "ENTRY label is missing explicit setup, bias, or trade direction intent."
          },
          {
            severity: "warning",
            code: "potential_visual_leakage",
            labelId: null,
            message: "Regular-mode labels can include visual leakage."
          }
        ]
      })
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("loads and renders review summary for the active session", async () => {
    render(<ReviewPanel />);

    await waitFor(() => {
      expect(useAppStore.getState().fetchReviewSummary).toHaveBeenCalledWith("session-1");
      expect(useAppStore.getState().fetchExportValidationReport).toHaveBeenCalledWith("session-1");
    });

    expect(screen.getByLabelText("Review dashboard")).toBeInTheDocument();
    expect(screen.getByLabelText("Session summary dashboard")).toHaveTextContent("Active Session");
    expect(screen.getByLabelText("Session summary dashboard")).toHaveTextContent("Needs review");
    expect(screen.getByLabelText("Session summary dashboard")).toHaveTextContent("Labels3");
    expect(screen.getByLabelText("Session summary dashboard")).toHaveTextContent("Top TypeENTRY");
    expect(screen.getByLabelText("Session summary dashboard")).toHaveTextContent("TickerSOXL");
    expect(screen.getByLabelText("Session summary dashboard")).toHaveTextContent("Timeframe4H");
    expect(screen.getByLabelText("Session summary dashboard")).toHaveTextContent("Replay-safe1");
    expect(screen.getByLabelText("Session summary dashboard")).toHaveTextContent("Linked1");
    expect(screen.getByLabelText("Session summary dashboard")).toHaveTextContent("Outcomes1");
    expect(screen.getByLabelText("Session summary dashboard")).toHaveTextContent("QA B/W/I0/3/2");
    expect(screen.getByLabelText("Session summary dashboard")).toHaveTextContent("Next ReviewReview warnings");
    expect(screen.getByText("Review Data")).toBeInTheDocument();
    expect(screen.getByLabelText("Dataset health summary")).not.toBeVisible();
    await userEvent.click(screen.getByText("Review Data"));
    await waitFor(() => {
      expect(screen.getByLabelText("Dataset health summary")).toBeVisible();
    });
    await userEvent.click(screen.getByRole("button", { name: "Warnings" }));
    expect(screen.getByRole("button", { name: "Warnings" })).toHaveClass("active");
    expect(screen.getByText("Active session")).toBeInTheDocument();
    expect(screen.getByLabelText("Dataset health summary")).toBeInTheDocument();
    expect(screen.getByText("Needs Review")).toBeInTheDocument();
    expect(screen.getByText("Paired Missing")).toBeInTheDocument();
    expect(screen.getByLabelText("Lifecycle coverage summary")).toHaveTextContent("Setup IDs2");
    expect(screen.getByLabelText("Lifecycle coverage summary")).toHaveTextContent("Top Roleentry");
    expect(screen.getByLabelText("Lifecycle coverage summary")).toHaveTextContent("Directionlong ticker");
    expect(screen.getByLabelText("Outcome export summary")).toHaveTextContent("Outcome Rows1");
    expect(screen.getByLabelText("Outcome export summary")).toHaveTextContent("Computed1");
    expect(screen.getByLabelText("Outcome export summary")).toHaveTextContent("Missing Exit0");
    expect(screen.getByLabelText("Outcome export summary")).toHaveTextContent("Decision CSVNo outcomes");
    expect(screen.getByLabelText("Outcome export summary")).toHaveTextContent("Ruleoutcome rule v1");
    expect(screen.getByLabelText("Research readiness summary")).toHaveTextContent("Research ReadinessNot ready");
    expect(screen.getByLabelText("Research readiness summary")).toHaveTextContent("Labels3");
    expect(screen.getByLabelText("Research readiness summary")).toHaveTextContent("Replay2");
    expect(screen.getByLabelText("Research readiness summary")).toHaveTextContent("Entries1");
    expect(screen.getByLabelText("Research readiness summary")).toHaveTextContent("Next GateNeed 25+ labels");
    expect(screen.getByLabelText("Replay-clean coverage summary")).toHaveTextContent("Replay CleanReplay-clean");
    expect(screen.getByLabelText("Replay-clean coverage summary")).toHaveTextContent("Replay-safe1");
    expect(screen.getByLabelText("Replay-clean coverage summary")).toHaveTextContent("Future-visible0");
    expect(screen.getByLabelText("Replay-clean coverage summary")).toHaveTextContent("Training SetUse replay-safe only");
    expect(screen.getByLabelText("Data review classification summary")).toHaveTextContent("Data Review2");
    expect(screen.getByLabelText("Data review classification summary")).toHaveTextContent("leveraged ETF volatility1");
    expect(screen.getByLabelText("Data review classification summary")).toHaveTextContent("session gap1");
    expect(screen.getByLabelText("Export readiness by issue severity")).toHaveTextContent("Blockers0");
    expect(screen.getByLabelText("Export readiness by issue severity")).toHaveTextContent("Warnings3");
    expect(screen.getByLabelText("Export readiness by issue severity")).toHaveTextContent("Info2");
    expect(screen.getByLabelText("Export readiness by issue severity")).toHaveTextContent("Export needs review5");
    expect(screen.getByLabelText("Actionable QA issue queue")).toHaveTextContent("Issue Queue5");
    expect(screen.getByLabelText("Actionable QA issue queue")).toHaveTextContent("missing paired context");
    expect(screen.getByLabelText("Actionable QA issue queue")).toHaveTextContent("ENTRY SOXL 4H 2024-01-02");
    expect(screen.getByLabelText("Actionable QA issue queue")).toHaveTextContent("Dataset issue");
    expect(screen.getByLabelText("Actionable QA issue queue")).toHaveTextContent(
      "Reload paired ETF context or mark this as unavailable before trusting the row."
    );
    expect(screen.getByLabelText("Actionable QA issue queue")).not.toHaveTextContent("data review session gap");
    expect(screen.getByLabelText("Actionable QA issue queue")).not.toHaveTextContent("No label context");
    await userEvent.click(screen.getByRole("button", { name: "Intent" }));
    expect(screen.getByLabelText("Actionable QA issue queue")).toHaveTextContent("entry intent incomplete");
    await userEvent.click(
      screen
        .getByLabelText("Actionable QA issue queue")
        .querySelector(".qa-issue-list button") as HTMLButtonElement
    );
    expect(useAppStore.getState().focusLabel).toHaveBeenCalledWith(
      expect.objectContaining({ id: "label-1" })
    );
    expect(screen.getByText("Win Rate")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("+10.00%")).toBeInTheDocument();
    expect(screen.getByText("trendline break")).toBeInTheDocument();
    expect(screen.getByText("Profitable Entries")).toBeInTheDocument();
    expect(screen.getByText("Skipped Trades")).toBeInTheDocument();
    expect(screen.getAllByText("SMIO")).toHaveLength(2);
  });

  it("loads all-label context so all-label QA rows are actionable", async () => {
    useAppStore.setState({
      activeSession: null,
      sessionLabels: [],
      listTradeEvents: vi.fn().mockResolvedValue([reviewLabel()])
    });

    render(<ReviewPanel />);

    await waitFor(() => {
      expect(useAppStore.getState().listTradeEvents).toHaveBeenCalledWith(undefined);
    });

    await userEvent.click(screen.getByText("Review Data"));
    expect(screen.getByText("All labels")).toBeInTheDocument();
    expect(screen.getByLabelText("Actionable QA issue queue")).toHaveTextContent("ENTRY SOXL 4H 2024-01-02");
    expect(screen.getByLabelText("Actionable QA issue queue")).not.toHaveTextContent("Missing label context");

    await userEvent.click(
      screen
        .getByLabelText("Actionable QA issue queue")
        .querySelector(".qa-issue-list button") as HTMLButtonElement
    );
    expect(useAppStore.getState().focusLabel).toHaveBeenCalledWith(
      expect.objectContaining({ id: "label-1" })
    );
  });

  it("starts a quick capture session from the empty dashboard action", async () => {
    const startSession = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({
      activeSession: null,
      sessionLabels: [],
      startSession,
      listTradeEvents: vi.fn().mockResolvedValue([]),
      fetchReviewSummary: vi.fn().mockResolvedValue({
        totalLabels: 0,
        counts: { ENTRY: 0, EXIT: 0, SKIP: 0, INVALID: 0 },
        confidenceDistribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
        setupQualityDistribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
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
      }),
      fetchExportValidationReport: vi.fn().mockResolvedValue({
        status: "pass",
        summary: {
          totalLabels: 0,
          errorCount: 0,
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
        issues: []
      })
    });

    render(<ReviewPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText("Session summary dashboard")).toHaveTextContent("No session");
      expect(screen.getByLabelText("Session summary dashboard")).toHaveTextContent("Next ReviewStart session");
    });

    await userEvent.click(screen.getByLabelText("Session summary next action"));

    expect(startSession).toHaveBeenCalledWith({
      name: "Quick capture",
      tickerFocus: "SOXL",
      timeframeFocus: "4H"
    });
  });

  it("keeps dataset-level QA rows selectable without pretending they have label context", async () => {
    render(<ReviewPanel />);

    await userEvent.click(screen.getByText("Review Data"));
    const datasetIssueButton = screen.getByText("potential visual leakage").closest("button");
    expect(datasetIssueButton).not.toBeNull();

    await userEvent.click(datasetIssueButton as HTMLButtonElement);

    expect(datasetIssueButton).toHaveClass("active");
    expect(screen.getByLabelText("Actionable QA issue queue")).toHaveTextContent("Dataset issue");
    expect(screen.getByLabelText("Actionable QA issue queue")).toHaveTextContent(
      "Prefer replay labels or confirm the visible boundary before using it for simulation."
    );
    expect(useAppStore.getState().focusLabel).not.toHaveBeenCalled();
  });

  it("marks regular-mode labels as future-visible coverage", async () => {
    const regularLabel = reviewLabel({
      id: "regular-label",
      captureMode: "regular",
      potentialVisualLeakage: true
    });
    useAppStore.setState({
      sessionLabels: [regularLabel],
      listTradeEvents: vi.fn().mockResolvedValue([regularLabel])
    });

    render(<ReviewPanel />);

    await userEvent.click(screen.getByText("Review Data"));

    expect(screen.getByLabelText("Replay-clean coverage summary")).toHaveTextContent(
      "Replay CleanRegular only"
    );
    expect(screen.getByLabelText("Replay-clean coverage summary")).toHaveTextContent("Replay-safe0");
    expect(screen.getByLabelText("Replay-clean coverage summary")).toHaveTextContent("Future-visible1");
    expect(screen.getByLabelText("Replay-clean coverage summary")).toHaveTextContent("Training SetCollect replay labels");
  });
});
