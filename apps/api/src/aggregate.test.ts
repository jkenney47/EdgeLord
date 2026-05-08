import { describe, expect, it } from "vitest";

import { aggregateBars } from "./aggregate";
import type { Bar } from "./schema";

describe("aggregateBars", () => {
  it("anchors 4H bars to extended-hours Eastern session buckets", () => {
    const bars = aggregateBars([
      bar("2026-05-11T08:30:00.000Z", { open: 10, high: 11, low: 9, close: 10.5, volume: 100 }),
      bar("2026-05-11T12:05:00.000Z", { open: 11, high: 12, low: 10, close: 11.5, volume: 200 }),
      bar("2026-05-11T16:01:00.000Z", { open: 12, high: 13, low: 11, close: 12.5, volume: 300 }),
      bar("2026-05-11T20:30:00.000Z", { open: 13, high: 14, low: 12, close: 13.5, volume: 400 })
    ], "4H");

    expect(bars.map((item) => item.timestamp)).toEqual([
      "2026-05-11T08:00:00.000Z",
      "2026-05-11T12:00:00.000Z",
      "2026-05-11T16:00:00.000Z",
      "2026-05-11T20:00:00.000Z"
    ]);
  });

  it("anchors 2H and 1D bars to the 4 a.m. Eastern extended session start", () => {
    const twoHourBars = aggregateBars([
      bar("2026-01-05T09:15:00.000Z"),
      bar("2026-01-05T11:45:00.000Z"),
      bar("2026-01-05T21:30:00.000Z")
    ], "2H");
    const dailyBars = aggregateBars([bar("2026-01-05T15:30:00.000Z")], "1D");

    expect(twoHourBars.map((item) => item.timestamp)).toEqual([
      "2026-01-05T09:00:00.000Z",
      "2026-01-05T11:00:00.000Z",
      "2026-01-05T21:00:00.000Z"
    ]);
    expect(dailyBars[0].timestamp).toBe("2026-01-05T09:00:00.000Z");
  });
});

function bar(timestamp: string, overrides: Partial<Bar> = {}): Bar {
  return {
    ticker: "SOXL",
    timeframe: "RAW",
    timestamp,
    open: 10,
    high: 11,
    low: 9,
    close: 10,
    volume: 100,
    source: "fixture",
    adjusted: 1,
    ...overrides
  };
}
