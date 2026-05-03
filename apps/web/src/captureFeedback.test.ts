import { describe, expect, it } from "vitest";

import { captureFeedback } from "./captureFeedback";

describe("captureFeedback", () => {
  it("makes closed-trade handoff explicit after exits", () => {
    expect(captureFeedback("EXIT", true)).toBe("EXIT saved; trade closed; advanced for SKIP/ENTRY review.");
    expect(captureFeedback("EXIT", false)).toBe("EXIT saved; trade closed. Next collect SKIP/ENTRY decisions.");
  });

  it("tells the user to review forward after entries", () => {
    expect(captureFeedback("ENTRY", true)).toBe("ENTRY saved; advanced to review the open trade.");
    expect(captureFeedback("ENTRY", false)).toBe("ENTRY saved; review forward until the exit.");
  });

  it("keeps skip and invalid feedback concise", () => {
    expect(captureFeedback("SKIP", true)).toBe("SKIP saved; advanced to next decision.");
    expect(captureFeedback("INVALID", false)).toBe("INVALID saved.");
  });
});
