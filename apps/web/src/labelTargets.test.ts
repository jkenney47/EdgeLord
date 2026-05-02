import { describe, expect, it } from "vitest";

import type { Label, Trade } from "./api";
import { labelTargetProgress } from "./labelTargets";

function label(action: Label["action"], trainingEligible = 1): Label {
  return {
    id: `${action}-${trainingEligible}`,
    label_source: "retrospective_replay",
    training_eligible: trainingEligible,
    action,
    ticker: "SOXL",
    timeframe: "4H",
    timestamp: "2024-01-02T14:30:00.000Z",
    bar_index: 0,
    chart_price: 10,
    execution_price: null,
    trade_id: null,
    parent_entry_label_id: null,
    capture_mode: "replay",
    visible_until_timestamp: "2024-01-02T14:30:00.000Z",
    potential_visual_leakage: 0,
    created_at: "2024-01-02T14:30:00.000Z"
  };
}

function trade(status: Trade["status"]): Trade {
  return {
    id: `trade-${status}`,
    ticker: "SOXL",
    entry_label_id: "entry",
    exit_label_id: status === "closed" ? "exit" : null,
    entry_timestamp: "2024-01-02T14:30:00.000Z",
    exit_timestamp: status === "closed" ? "2024-01-03T14:30:00.000Z" : null,
    entry_price: 10,
    exit_price: status === "closed" ? 11 : null,
    return_pct: status === "closed" ? 10 : null,
    status
  };
}

describe("labelTargetProgress", () => {
  it("counts only training-eligible labels for decision targets", () => {
    const progress = labelTargetProgress([
      label("ENTRY"),
      label("SKIP"),
      label("SKIP", 0)
    ], [trade("closed"), trade("open")]);

    expect(progress.map((item) => [item.key, item.current])).toEqual([
      ["decisions", 2],
      ["entries", 1],
      ["skips", 1],
      ["closedTrades", 1]
    ]);
  });
});
