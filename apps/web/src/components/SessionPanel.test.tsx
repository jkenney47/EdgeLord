import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionPanel } from "./SessionPanel";
import { createInitialState, useAppStore } from "../store/useAppStore";
import type { Session } from "../api/client";

const session: Session = {
  id: "session-1",
  name: "Morning replay",
  startTime: "2024-01-02T14:30:00.000Z",
  endTime: null,
  tickerFocus: "SOXL",
  timeframeFocus: "4H",
  notes: null,
  createdAt: "2024-01-02T14:30:00.000Z",
  updatedAt: "2024-01-02T14:30:00.000Z"
};

describe("SessionPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAppStore.setState({
      ...createInitialState(),
      sessions: [session],
      listSessions: vi.fn().mockResolvedValue([session]),
      createSession: vi.fn().mockResolvedValue(session),
      endSession: vi.fn().mockResolvedValue({ ...session, endTime: "2024-01-02T16:00:00.000Z" }),
      listTradeEvents: vi.fn().mockResolvedValue([]),
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
      }),
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
          entries: { count: 0, smioOscillator: null, stochK: null, stochD: null, atr14Rma: null, ema25DistancePercent: null },
          profitableEntries: { count: 0, smioOscillator: null, stochK: null, stochD: null, atr14Rma: null, ema25DistancePercent: null },
          losingEntries: { count: 0, smioOscillator: null, stochK: null, stochD: null, atr14Rma: null, ema25DistancePercent: null },
          skipped: { count: 0, smioOscillator: null, stochK: null, stochD: null, atr14Rma: null, ema25DistancePercent: null }
        },
        lossClusters: {
          reasonCodes: {},
          worstPairs: []
        }
      })
    });
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("starts, resumes, and ends sessions", async () => {
    render(<SessionPanel />);

    await waitFor(() => {
      expect(useAppStore.getState().listSessions).toHaveBeenCalled();
    });

    await userEvent.click(screen.getByText("Session"));
    await userEvent.type(screen.getByLabelText("Session name"), "Test replay");
    await userEvent.click(screen.getByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(useAppStore.getState().createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test replay",
          timeframeFocus: "4H"
        })
      );
    });

    await userEvent.click(screen.getByRole("button", { name: "Resume Morning replay 2024-01-02" }));

    await waitFor(() => {
      expect(useAppStore.getState().listTradeEvents).toHaveBeenCalledWith("session-1");
      expect(useAppStore.getState().fetchReviewSummary).toHaveBeenCalledWith("session-1");
    });

    await userEvent.click(screen.getByRole("button", { name: "End" }));

    await waitFor(() => {
      expect(useAppStore.getState().endSession).toHaveBeenCalledWith("session-1");
    });
  });

  it("auto-resumes the remembered open session", async () => {
    window.localStorage.setItem("edgelord.activeSessionId", "session-1");

    render(<SessionPanel />);

    await waitFor(() => {
      expect(useAppStore.getState().listSessions).toHaveBeenCalled();
      expect(useAppStore.getState().listTradeEvents).toHaveBeenCalledWith("session-1");
      expect(useAppStore.getState().activeSession?.id).toBe("session-1");
    });
  });
});
