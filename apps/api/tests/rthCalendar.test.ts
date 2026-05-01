import { describe, expect, it } from "vitest";

import {
  isRegularTradingMinute,
  sessionCloseForDate,
  sessionDateForTimestamp,
  sessionOpenForDate,
  toNewYorkTime
} from "../src/aggregation/rthCalendar.js";

describe("RTH calendar utilities", () => {
  it("converts UTC timestamps into New York date parts", () => {
    expect(toNewYorkTime("2024-01-02T14:30:00.000Z")).toMatchObject({
      year: 2024,
      month: 1,
      day: 2,
      hour: 9,
      minute: 30
    });

    expect(toNewYorkTime("2024-07-01T13:30:00.000Z")).toMatchObject({
      year: 2024,
      month: 7,
      day: 1,
      hour: 9,
      minute: 30
    });
  });

  it("detects regular trading minutes using 9:30-16:00 ET", () => {
    expect(isRegularTradingMinute("2024-01-02T14:29:00.000Z")).toBe(false);
    expect(isRegularTradingMinute("2024-01-02T14:30:00.000Z")).toBe(true);
    expect(isRegularTradingMinute("2024-01-02T20:59:00.000Z")).toBe(true);
    expect(isRegularTradingMinute("2024-01-02T21:00:00.000Z")).toBe(false);

    expect(isRegularTradingMinute("2024-07-01T13:29:00.000Z")).toBe(false);
    expect(isRegularTradingMinute("2024-07-01T13:30:00.000Z")).toBe(true);
    expect(isRegularTradingMinute("2024-07-01T19:59:00.000Z")).toBe(true);
    expect(isRegularTradingMinute("2024-07-01T20:00:00.000Z")).toBe(false);
  });

  it("returns session dates and UTC open/close timestamps across DST", () => {
    expect(sessionDateForTimestamp("2024-01-02T15:00:00.000Z")).toBe("2024-01-02");
    expect(sessionOpenForDate("2024-01-02")).toBe("2024-01-02T14:30:00.000Z");
    expect(sessionCloseForDate("2024-01-02")).toBe("2024-01-02T21:00:00.000Z");

    expect(sessionDateForTimestamp("2024-07-01T14:00:00.000Z")).toBe("2024-07-01");
    expect(sessionOpenForDate("2024-07-01")).toBe("2024-07-01T13:30:00.000Z");
    expect(sessionCloseForDate("2024-07-01")).toBe("2024-07-01T20:00:00.000Z");
  });
});
