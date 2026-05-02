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
      label("SKIP", { id: "skip", training_eligible: 1 }),
      label("ENTRY", { id: "hindsight", label_source: "retrospective_hindsight", training_eligible: 0 })
    ];
    const trades = [trade("open")];

    const pulse = buildDatasetPulse(barSummary, labels, trades);

    expect(pulse.dataReadiness.code).toBe("ready");
    expect(pulse.labels.total).toBe(3);
    expect(pulse.labels.trainingEligible).toBe(2);
    expect(pulse.labels.excluded).toBe(1);
    expect(pulse.targets.find((target) => target.key === "decisions")?.current).toBe(2);
    expect(pulse.trades.openTrade?.ticker).toBe("SOXL");
    expect(pulse.nextActions[0]).toContain("open SOXL trade");
  });

  it("pushes skip collection before more generic target guidance", () => {
    const labels = [label("ENTRY", { training_eligible: 1 })];
    const pulse = buildDatasetPulse(barSummary, labels, []);

    expect(pulse.nextActions[0]).toContain("SKIP labels");
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
  return {
    id: "trade",
    ticker: "SOXL",
    entry_label_id: "entry",
    exit_label_id: status === "closed" ? "exit" : null,
    entry_timestamp: "2024-01-02T14:30:00.000Z",
    exit_timestamp: status === "closed" ? "2024-01-03T14:30:00.000Z" : null,
    entry_price: 28.19,
    exit_price: status === "closed" ? 29 : null,
    return_pct: status === "closed" ? 2.87 : null,
    status,
    created_at: "2024-01-02T14:30:00.000Z",
    updated_at: "2024-01-02T14:30:00.000Z"
  };
}
