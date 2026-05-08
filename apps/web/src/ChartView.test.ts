import { describe, expect, it } from "vitest";

import type { Bar } from "./api";
import { findBarForChartTime } from "./ChartView";

describe("findBarForChartTime", () => {
  it("matches a chart timestamp to the exact visible bar", () => {
    const bars = [
      bar("2026-05-07T08:00:00.000Z"),
      bar("2026-05-07T12:00:00.000Z")
    ];

    expect(findBarForChartTime(bars, 1778155200 as never)?.timestamp).toBe("2026-05-07T12:00:00.000Z");
  });

  it("ignores empty crosshair time", () => {
    expect(findBarForChartTime([bar("2026-05-07T08:00:00.000Z")], undefined)).toBeNull();
  });
});

function bar(timestamp: string): Bar {
  return {
    ticker: "SOXL",
    timeframe: "4H",
    timestamp,
    open: 1,
    high: 2,
    low: 0.5,
    close: 1.5,
    volume: 100
  };
}
