import { describe, expect, it } from "vitest";

import { buildDatasetPulse } from "./dataset";
import type { BarSummaryRow } from "./bars";
import type { Label, Trade } from "./schema";

const barSummary: BarSummaryRow[] = [
  row("SOXL", "RAW", "csv", 1000, "2016-01-04T14:30:00.000Z", "2026-04-01T19:59:00.000Z"),
  row("SOXS", "RAW", "csv", 1000, "2016-01-04T14:30:00.000Z", "2026-04-01T19:59:00.000Z"),
  row("SOXL", "1D", "aggregate", 100, "2016-01-04T14:30:00.000Z", "2026-04-01T14:30:00.000Z"),
  row("SOXL", "4H", "aggregate", 100, "2016-01-04T14:30:00.000Z", "2026-04-01T18:30:00.000Z"),
  row("SOXL", "2H", "aggregate", 100, "2016-01-04T14:30:00.000Z", "2026-04-01T18:30:00.000Z"),
  row("SOXS", "1D", "aggregate", 100, "2016-01-04T14:30:00.000Z", "2026-04-01T14:30:00.000Z"),
  row("SOXS", "4H", "aggregate", 100, "2016-01-04T14:30:00.000Z", "2026-04-01T18:30:00.000Z"),
  row("SOXS", "2H", "aggregate", 100, "2016-01-04T14:30:00.000Z", "2026-04-01T18:30:00.000Z")
];

describe("buildDatasetPulse", () => {
  it("summarizes data, target progress, and the next labeling action", () => {
    const labels = [
      label("ENTRY", { id: "entry", trade_id: "trade", training_eligible: 1 }),
      label("SKIP", { id: "skip", training_eligible: 1, timestamp: "2024-01-02T18:30:00.000Z" }),
      label("SKIP", { id: "hindsight", label_source: "retrospective_hindsight", training_eligible: 1 })
    ];
    const trades = [trade("open")];

    const pulse = buildDatasetPulse(barSummary, labels, trades);

    expect(pulse.dataReadiness.code).toBe("alpaca_era_ready");
    expect(pulse.dataReadiness.text).toBe("Alpaca-era 2016+");
    expect(pulse.dataReadiness.unresolvedTargetGap).toMatchObject({
      targetStart: "2011-01-01T00:00:00.000Z",
      missingEnd: "2016-01-04T14:30:00.000Z",
      status: "unresolved_external_data_source"
    });
    expect(pulse.dataReadiness.unresolvedTargetGap?.gapYears).toBe(5);
    expect(pulse.labels.total).toBe(3);
    expect(pulse.labels.trainingEligible).toBe(3);
    expect(pulse.labels.excluded).toBe(0);
    expect(pulse.integrity.ready).toBe(true);
    expect(pulse.targets.find((target) => target.key === "decisions")?.current).toBe(3);
    expect(pulse.targets.find((target) => target.key === "exits")?.target).toBe(1);
    expect(pulse.trades.openTrade?.ticker).toBe("SOXL");
    expect(pulse.trainingCoverage.years["2024"]).toBe(3);
    expect(pulse.trainingCoverage.tickerTimeframes["SOXL:4H"]).toBe(3);
    expect(pulse.trainingCoverage.yearActions["2024:ENTRY"]).toBe(1);
    expect(pulse.trainingCoverage.weakestYears[0]).toEqual({ year: "2024", rows: 3 });
    expect(pulse.trainingCoverage.weakestTickerTimeframes[0]).toEqual({ tickerTimeframe: "SOXL:4H", rows: 3 });
    expect(pulse.nextTarget.kind).toBe("exit_coverage");
    expect(pulse.nextActions[0]).toContain("open SOXL trade");
    expect(pulse.nextActions[1]).toContain("SOXL:4H");
  });

  it("pushes exit coverage before skip collection when entries are unpaired", () => {
    const labels = [label("ENTRY", { id: "entry", trade_id: "trade", training_eligible: 1 })];
    const pulse = buildDatasetPulse(barSummary, labels, [trade("open")]);

    expect(pulse.nextTarget.kind).toBe("exit_coverage");
    expect(pulse.nextActions[0]).toContain("open SOXL trade");
  });

  it("pushes skip collection after exit coverage is caught up", () => {
    const labels = [
      label("ENTRY", { id: "entry", trade_id: "trade", training_eligible: 1 }),
      label("EXIT", {
        id: "exit",
        trade_id: "trade",
        parent_entry_label_id: "entry",
        training_eligible: 1,
        timestamp: "2024-01-03T14:30:00.000Z",
        chart_price: 29
      })
    ];
    const trades = [trade("closed")];
    const pulse = buildDatasetPulse(barSummary, labels, trades);

    expect(pulse.nextTarget.kind).toBe("skip_coverage");
    expect(pulse.nextTarget.target).toBe(1);
    expect(pulse.nextTarget.remaining).toBe(1);
    expect(pulse.targets.find((target) => target.key === "skips")?.target).toBe(100);
    expect(pulse.nextActions[0]).toContain("SKIP labels");
  });

  it("does not count explicitly ineligible closed trades toward closed-trade target progress", () => {
    const labels = [
      label("ENTRY", { id: "entry", trade_id: "trade", training_eligible: 1 }),
      label("EXIT", {
        id: "exit",
        trade_id: "trade",
        parent_entry_label_id: "entry",
        training_eligible: 1,
        timestamp: "2024-01-03T14:30:00.000Z",
        chart_price: 29
      }),
      label("ENTRY", {
        id: "ineligible-entry",
        label_source: "retrospective_replay",
        trade_id: "ineligible-trade",
        training_eligible: 0,
        timestamp: "2024-01-04T14:30:00.000Z"
      }),
      label("EXIT", {
        id: "ineligible-exit",
        label_source: "retrospective_replay",
        trade_id: "ineligible-trade",
        parent_entry_label_id: "ineligible-entry",
        training_eligible: 0,
        timestamp: "2024-01-05T14:30:00.000Z",
        chart_price: 29
      })
    ];
    const trades = [
      trade("closed"),
      {
        ...trade("closed"),
        id: "ineligible-trade",
        entry_label_id: "ineligible-entry",
        exit_label_id: "ineligible-exit",
        entry_timestamp: "2024-01-04T14:30:00.000Z",
        exit_timestamp: "2024-01-05T14:30:00.000Z"
      }
    ];

    const pulse = buildDatasetPulse(barSummary, labels, trades);

    expect(pulse.trades.closed).toBe(2);
    expect(pulse.trades.trainingEligibleClosed).toBe(1);
    expect(pulse.trades.ineligibleClosed).toBe(1);
    expect(pulse.tradeCandidates).toMatchObject({
      rows: 2,
      closedTrades: 1,
      closedTradesWithCandidates: 1,
      missingClosedTradeCandidateIds: []
    });
    expect(pulse.targets.find((target) => target.key === "closedTrades")?.current).toBe(1);
  });

  it("keeps skip focus balanced with entries while preserving rough skip target", () => {
    const labels = [
      label("ENTRY", { id: "entry-1", trade_id: "trade-1", training_eligible: 1 }),
      label("EXIT", {
        id: "exit-1",
        trade_id: "trade-1",
        parent_entry_label_id: "entry-1",
        training_eligible: 1,
        timestamp: "2024-01-03T14:30:00.000Z",
        chart_price: 29
      }),
      label("ENTRY", {
        id: "entry-2",
        trade_id: "trade-2",
        training_eligible: 1,
        timestamp: "2024-01-04T14:30:00.000Z"
      }),
      label("EXIT", {
        id: "exit-2",
        trade_id: "trade-2",
        parent_entry_label_id: "entry-2",
        training_eligible: 1,
        timestamp: "2024-01-05T14:30:00.000Z",
        chart_price: 29
      }),
      label("SKIP", {
        id: "skip-1",
        training_eligible: 1,
        timestamp: "2024-01-06T14:30:00.000Z"
      })
    ];
    const trades = [
      {
        ...trade("closed"),
        id: "trade-1",
        entry_label_id: "entry-1",
        exit_label_id: "exit-1"
      },
      {
      ...trade("closed"),
      id: "trade-2",
      entry_label_id: "entry-2",
      exit_label_id: "exit-2",
      entry_timestamp: "2024-01-04T14:30:00.000Z",
      exit_timestamp: "2024-01-05T14:30:00.000Z"
    }];
    const pulse = buildDatasetPulse(barSummary, labels, trades);

    expect(pulse.nextTarget.kind).toBe("skip_coverage");
    expect(pulse.nextTarget.current).toBe(1);
    expect(pulse.nextTarget.target).toBe(2);
    expect(pulse.nextTarget.remaining).toBe(1);
    expect(pulse.targets.find((target) => target.key === "skips")?.target).toBe(100);
  });

  it("pushes integrity repair before new labeling targets", () => {
    const labels = [
      label("ENTRY", { id: "entry", trade_id: null, training_eligible: 1 }),
      label("SKIP", { id: "skip", training_eligible: 1 }),
      label("INVALID", { id: "invalid", training_eligible: 1 })
    ];

    const pulse = buildDatasetPulse(barSummary, labels, []);

    expect(pulse.integrity.ready).toBe(false);
    expect(pulse.integrity.entriesWithoutTrade).toBe(1);
    expect(pulse.integrity.sameCandleDecisionConflicts).toBe(1);
    expect(pulse.nextTarget.kind).toBe("fix_integrity");
  });

  it("counts trade-ledger inconsistencies as integrity issues", () => {
    const labels = [
      label("ENTRY", { id: "entry", trade_id: "trade", training_eligible: 1 }),
      label("EXIT", {
        id: "exit",
        trade_id: "trade",
        parent_entry_label_id: "entry",
        training_eligible: 1,
        timestamp: "2024-01-03T14:30:00.000Z",
        chart_price: 29
      })
    ];
    const trades = [
      {
        ...trade("closed"),
        exit_price: 30,
        return_pct: 99
      }
    ];

    const pulse = buildDatasetPulse(barSummary, labels, trades);

    expect(pulse.integrity.ready).toBe(false);
    expect(pulse.integrity.tradeConsistencyIssues).toBeGreaterThan(0);
    expect(pulse.nextTarget.kind).toBe("fix_integrity");
  });

  it("does not report a target gap when data reaches the target start", () => {
    const fullCoverage = barSummary.map((item) => ({ ...item, first: "2011-01-01T14:30:00.000Z" }));
    const pulse = buildDatasetPulse(fullCoverage, [], []);

    expect(pulse.dataReadiness.code).toBe("ready");
    expect(pulse.dataReadiness.unresolvedTargetGap).toBeNull();
  });
});

function row(
  ticker: BarSummaryRow["ticker"],
  timeframe: BarSummaryRow["timeframe"],
  source: string,
  bars: number,
  first: string,
  last: string
): BarSummaryRow {
  return { ticker, timeframe, source, bars, first, last };
}

function label(action: Label["action"], overrides: Partial<Label> = {}): Label {
  return {
    id: "label",
    label_source: "retrospective_replay",
    training_eligible: 1,
    action,
    ticker: "SOXL",
    timeframe: "4H",
    timestamp: "2024-01-02T14:30:00.000Z",
    bar_index: 0,
    chart_price: 28.19,
    execution_price: null,
    trade_id: null,
    parent_entry_label_id: null,
    capture_mode: "replay",
    visible_until_timestamp: "2024-01-02T14:30:00.000Z",
    potential_visual_leakage: 0,
    confidence: null,
    setup_quality: null,
    reason_codes_json: "[]",
    notes: null,
    features_json: "{}",
    created_at: "2024-01-02T14:30:00.000Z",
    updated_at: "2024-01-02T14:30:00.000Z",
    deleted_at: null,
    ...overrides
  };
}

function trade(status: Trade["status"]): Trade {
  const entryPrice = 28.19;
  const exitPrice = status === "closed" ? 29 : null;
  return {
    id: "trade",
    ticker: "SOXL",
    entry_label_id: "entry",
    exit_label_id: status === "closed" ? "exit" : null,
    entry_timestamp: "2024-01-02T14:30:00.000Z",
    exit_timestamp: status === "closed" ? "2024-01-03T14:30:00.000Z" : null,
    entry_price: entryPrice,
    exit_price: exitPrice,
    return_pct: exitPrice === null ? null : ((exitPrice - entryPrice) / entryPrice) * 100,
    status,
    created_at: "2024-01-02T14:30:00.000Z",
    updated_at: "2024-01-02T14:30:00.000Z"
  };
}
