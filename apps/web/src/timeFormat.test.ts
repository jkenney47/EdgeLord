import { describe, expect, it } from "vitest";

import { formatEasternTime } from "./timeFormat";

describe("formatEasternTime", () => {
  it("formats chart timestamps as Eastern time with a 12-hour clock", () => {
    expect(formatEasternTime("2026-05-11T13:00:00.000Z")).toBe("Mon May 11, 2026 09:00 AM");
  });
});
