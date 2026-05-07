import { describe, expect, it } from "vitest";

import { exportManifest, exportSchemaCatalog } from "./export";
import type { Label, Trade } from "./schema";

describe("exportManifest", () => {
  it("does not require trade candidates for closed trades with explicitly ineligible entry and exit labels", () => {
    const labels = [
      label("ENTRY", {
        id: "entry",
        label_source: "retrospective_replay",
        training_eligible: 0,
        action: "ENTRY",
        trade_id: "trade"
      }),
      label("EXIT", {
        id: "exit",
        label_source: "retrospective_replay",
        training_eligible: 0,
        action: "EXIT",
        trade_id: "trade",
        parent_entry_label_id: "entry"
      })
    ];
    const trades = [trade()];

    const manifest = exportManifest(labels, trades);

    expect(manifest.trades).toMatchObject({
      closed: 1,
      trainingEligibleClosed: 0,
      ineligibleClosed: 1
    });
    expect(manifest.tradeCandidates).toMatchObject({
      rows: 0,
      closedTrades: 0,
      closedTradesWithCandidates: 0,
      missingClosedTradeCandidateIds: [],
      extraCandidateTradeIds: [],
      duplicateCandidateIds: []
    });
  });

  it("reports training-eligible closed trades that do not have candidate rows", () => {
    const labels = [
      label("ENTRY", { id: "entry", action: "ENTRY", trade_id: "trade" }),
      label("EXIT", { id: "exit", action: "EXIT", trade_id: "trade", parent_entry_label_id: "entry" })
    ];
    const trades = [trade()];

    const manifest = exportManifest(labels, trades);

    expect(manifest.trades).toMatchObject({
      closed: 1,
      trainingEligibleClosed: 1,
      ineligibleClosed: 0
    });
    expect(manifest.tradeCandidates).toMatchObject({
      rows: 0,
      closedTrades: 1,
      closedTradesWithCandidates: 0,
      missingClosedTradeCandidateIds: ["trade"],
      extraCandidateTradeIds: [],
      duplicateCandidateIds: []
    });
  });
});

describe("exportSchemaCatalog", () => {
  it("includes the full background indicator stack for 1D, 4H, and 2H research features", () => {
    const schema = exportSchemaCatalog() as {
      files: { "training-features.csv": { columns: string[] } };
      features: Array<{ column: string; pineSupport: string }>;
    };
    const columns = schema.files["training-features.csv"].columns;

    expect(columns).toContain("feature_d1_smio_oscillator");
    expect(columns).toContain("feature_h4_vwap");
    expect(columns).toContain("feature_h2_wvf_filtered_entry");
    expect(columns).toContain("feature_d1_stoch_rsi_k");
    expect(columns).toContain("feature_h4_pair_ratio_close");

    expect(schema.features.find((feature) => feature.column === "feature_h2_vwap")).toMatchObject({
      pineSupport: "research_only"
    });
  });
});

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

function trade(): Trade {
  return {
    id: "trade",
    ticker: "SOXL",
    entry_label_id: "entry",
    exit_label_id: "exit",
    entry_timestamp: "2024-01-02T14:30:00.000Z",
    exit_timestamp: "2024-01-03T14:30:00.000Z",
    entry_price: 28.19,
    exit_price: 29,
    return_pct: 2.87,
    status: "closed",
    created_at: "2024-01-02T14:30:00.000Z",
    updated_at: "2024-01-02T14:30:00.000Z"
  };
}
