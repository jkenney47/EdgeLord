import { describe, expect, it } from "vitest";

import { normalizeLabelSourceForMode } from "./labelSourceMode";

describe("normalizeLabelSourceForMode", () => {
  it("keeps retrospective replay labels in replay mode", () => {
    expect(normalizeLabelSourceForMode("replay", "retrospective_replay")).toBe("retrospective_replay");
  });

  it("keeps actual trade labels in replay and regular modes", () => {
    expect(normalizeLabelSourceForMode("replay", "actual_trade")).toBe("actual_trade");
    expect(normalizeLabelSourceForMode("regular", "actual_trade")).toBe("actual_trade");
  });

  it("moves hindsight labels to replay labels in replay mode", () => {
    expect(normalizeLabelSourceForMode("replay", "retrospective_hindsight")).toBe("retrospective_replay");
  });

  it("moves replay labels to hindsight labels in regular mode", () => {
    expect(normalizeLabelSourceForMode("regular", "retrospective_replay")).toBe("retrospective_hindsight");
  });
});
