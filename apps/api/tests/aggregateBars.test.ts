import { describe, expect, it } from "vitest";

import { aggregateRthBars } from "../src/aggregation/aggregateBars.js";
import type { BaseBar } from "../src/market-data/types.js";

function minuteBars({
  ticker,
  start,
  count,
  baseOpen = 100
}: {
  ticker: string;
  start: string;
  count: number;
  baseOpen?: number;
}): BaseBar[] {
  const startMs = new Date(start).getTime();

  return Array.from({ length: count }, (_, index) => {
    const open = baseOpen + index;
    return {
      ticker,
      timestamp: new Date(startMs + index * 60_000).toISOString(),
      open,
      high: open + 2,
      low: open - 1,
      close: open + 1,
      volume: 10 + index
    };
  });
}

function fiveMinuteBars({
  ticker,
  start,
  count,
  baseOpen = 100
}: {
  ticker: string;
  start: string;
  count: number;
  baseOpen?: number;
}): BaseBar[] {
  const startMs = new Date(start).getTime();

  return Array.from({ length: count }, (_, index) => {
    const open = baseOpen + index * 5;
    return {
      ticker,
      timestamp: new Date(startMs + index * 5 * 60_000).toISOString(),
      open,
      high: open + 2,
      low: open - 1,
      close: open + 1,
      volume: 50 + index
    };
  });
}

describe("aggregateRthBars", () => {
  it("aggregates completed 2H RTH candles and drops the final partial bucket", () => {
    const bars = minuteBars({
      ticker: "SOXL",
      start: "2024-01-02T14:30:00.000Z",
      count: 390
    });

    const aggregated = aggregateRthBars(bars, "2H");

    expect(aggregated).toHaveLength(3);
    expect(aggregated.map((bar) => bar.timestamp)).toEqual([
      "2024-01-02T14:30:00.000Z",
      "2024-01-02T16:30:00.000Z",
      "2024-01-02T18:30:00.000Z"
    ]);
    expect(aggregated.every((bar) => bar.sourceBarCount === 120)).toBe(true);
  });

  it("aggregates the first completed 4H RTH candle and drops the partial afternoon bucket", () => {
    const bars = minuteBars({
      ticker: "SOXL",
      start: "2024-01-02T14:30:00.000Z",
      count: 390
    });

    const aggregated = aggregateRthBars(bars, "4H");

    expect(aggregated).toEqual([
      {
        ticker: "SOXL",
        timeframe: "4H",
        timestamp: "2024-01-02T14:30:00.000Z",
        open: 100,
        high: 341,
        low: 99,
        close: 340,
        volume: 31_080,
        sourceBarCount: 240
      }
    ]);
  });

  it("keeps completed RTH buckets when the feed is missing sparse minutes", () => {
    const bars = minuteBars({
      ticker: "SOXL",
      start: "2024-01-02T14:30:00.000Z",
      count: 390
    }).filter((_, index) => ![10, 25, 60, 150, 220, 260, 300, 340].includes(index));

    const daily = aggregateRthBars(bars, "1D");
    const fourHour = aggregateRthBars(bars, "4H");
    const twoHour = aggregateRthBars(bars, "2H");

    expect(daily).toHaveLength(1);
    expect(daily[0]).toMatchObject({
      timestamp: "2024-01-02T14:30:00.000Z",
      sourceBarCount: 382
    });
    expect(fourHour).toHaveLength(1);
    expect(fourHour[0]).toMatchObject({
      timestamp: "2024-01-02T14:30:00.000Z",
      sourceBarCount: 235
    });
    expect(twoHour.map((bar) => bar.timestamp)).toEqual([
      "2024-01-02T14:30:00.000Z",
      "2024-01-02T16:30:00.000Z",
      "2024-01-02T18:30:00.000Z"
    ]);
    expect(twoHour.map((bar) => bar.sourceBarCount)).toEqual([117, 118, 117]);
  });

  it("aggregates completed buckets from 5Min source bars with minute-equivalent coverage", () => {
    const bars = fiveMinuteBars({
      ticker: "SOXL",
      start: "2024-01-02T14:30:00.000Z",
      count: 78
    });

    const daily = aggregateRthBars(bars, "1D", "5Min");
    const fourHour = aggregateRthBars(bars, "4H", "5Min");
    const twoHour = aggregateRthBars(bars, "2H", "5Min");

    expect(daily).toEqual([
      expect.objectContaining({
        timestamp: "2024-01-02T14:30:00.000Z",
        sourceBarCount: 390
      })
    ]);
    expect(fourHour).toEqual([
      expect.objectContaining({
        timestamp: "2024-01-02T14:30:00.000Z",
        sourceBarCount: 240
      })
    ]);
    expect(twoHour.map((bar) => [bar.timestamp, bar.sourceBarCount])).toEqual([
      ["2024-01-02T14:30:00.000Z", 120],
      ["2024-01-02T16:30:00.000Z", 120],
      ["2024-01-02T18:30:00.000Z", 120]
    ]);
  });

  it("resets 4H buckets at each New York session open and never spans days", () => {
    const bars = [
      ...minuteBars({
        ticker: "SOXL",
        start: "2024-01-02T14:30:00.000Z",
        count: 390,
        baseOpen: 100
      }),
      ...minuteBars({
        ticker: "SOXL",
        start: "2024-01-03T14:30:00.000Z",
        count: 390,
        baseOpen: 1000
      })
    ];

    const aggregated = aggregateRthBars(bars, "4H");

    expect(aggregated.map((bar) => bar.timestamp)).toEqual([
      "2024-01-02T14:30:00.000Z",
      "2024-01-03T14:30:00.000Z"
    ]);
    expect(aggregated[0].open).toBe(100);
    expect(aggregated[1].open).toBe(1000);
  });

  it("aggregates a completed 1D RTH session", () => {
    const bars = minuteBars({
      ticker: "SOXL",
      start: "2024-01-02T14:30:00.000Z",
      count: 390
    });

    const aggregated = aggregateRthBars(bars, "1D");

    expect(aggregated).toEqual([
      {
        ticker: "SOXL",
        timeframe: "1D",
        timestamp: "2024-01-02T14:30:00.000Z",
        open: 100,
        high: 491,
        low: 99,
        close: 490,
        volume: 79_755,
        sourceBarCount: 390
      }
    ]);
  });

  it("ignores non-RTH bars before aggregating", () => {
    const bars = [
      ...minuteBars({
        ticker: "SOXL",
        start: "2024-01-02T13:00:00.000Z",
        count: 90,
        baseOpen: 1
      }),
      ...minuteBars({
        ticker: "SOXL",
        start: "2024-01-02T14:30:00.000Z",
        count: 240,
        baseOpen: 100
      })
    ];

    const aggregated = aggregateRthBars(bars, "4H");

    expect(aggregated).toHaveLength(1);
    expect(aggregated[0]).toMatchObject({
      timestamp: "2024-01-02T14:30:00.000Z",
      open: 100,
      sourceBarCount: 240
    });
  });
});
