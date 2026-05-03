import { describe, expect, it } from "vitest";

import { shouldDeferBarResetForPendingSelection } from "./pendingSelection";

describe("shouldDeferBarResetForPendingSelection", () => {
  it("defers the default bar reset while the requested bars can satisfy the pending selection", () => {
    expect(shouldDeferBarResetForPendingSelection({ ticker: "SOXL", timeframe: "4H" }, "SOXL", "4H")).toBe(true);
  });

  it("allows normal reset when there is no pending selection or another chart is loading", () => {
    expect(shouldDeferBarResetForPendingSelection(null, "SOXL", "4H")).toBe(false);
    expect(shouldDeferBarResetForPendingSelection({ ticker: "SOXS", timeframe: "4H" }, "SOXL", "4H")).toBe(false);
    expect(shouldDeferBarResetForPendingSelection({ ticker: "SOXL", timeframe: "2H" }, "SOXL", "4H")).toBe(false);
  });
});
