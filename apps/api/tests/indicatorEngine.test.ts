import { describe, expect, it } from "vitest";

import { computeIndicatorSnapshots } from "../src/indicators/indicatorEngine.js";
import type { AggregatedBar } from "../src/aggregation/aggregateBars.js";

function bars(count: number): AggregatedBar[] {
  const startMs = new Date("2024-01-02T14:30:00.000Z").getTime();

  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin(index / 3) * 2;
    const close = 100 + index * 0.8 + wave;
    const open = close - 0.5;

    return {
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: new Date(startMs + index * 24 * 60 * 60 * 1000).toISOString(),
      open,
      high: close + 2 + (index % 4),
      low: close - 2 - (index % 3),
      close,
      volume: 1_000_000 + index * 10_000,
      sourceBarCount: 240
    };
  });
}

describe("indicator engine", () => {
  it("computes the required indicator snapshot fields", () => {
    const snapshots = computeIndicatorSnapshots(bars(130));
    const latest = snapshots[129];

    expect(latest).toMatchObject({
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: expect.any(String),
      volume: expect.any(Number),
      volumeSma20: expect.any(Number),
      ema25: expect.any(Number),
      sma100: expect.any(Number),
      monthlyVwap: expect.any(Number),
      atr14Rma: expect.any(Number),
      smio: expect.objectContaining({
        erg: expect.any(Number),
        signal: expect.any(Number),
        oscillator: expect.any(Number)
      }),
      stochRsi: expect.objectContaining({
        rsi: expect.any(Number),
        k: expect.any(Number),
        d: expect.any(Number)
      }),
      cmWvf: expect.objectContaining({
        wvf: expect.any(Number),
        plot: expect.any(Number),
        upperBand: expect.any(Number),
        rangeHigh: expect.any(Number),
        alert1: expect.any(Boolean),
        alert2: expect.any(Boolean),
        alert3: expect.any(Boolean),
        alert4: expect.any(Boolean),
        filtered: expect.any(Boolean),
        filteredAggressive: expect.any(Boolean)
      })
    });
  });

  it("does not let future candles alter prior indicator snapshots", () => {
    const originalBars = bars(130);
    const changedFutureBars = originalBars.map((bar, index) =>
      index >= 90
        ? {
            ...bar,
            high: bar.high + 500,
            low: bar.low - 500,
            close: bar.close + 250,
            volume: bar.volume + 9_000_000
          }
        : bar
    );

    const original = computeIndicatorSnapshots(originalBars);
    const changed = computeIndicatorSnapshots(changedFutureBars);

    expect(changed[80]).toEqual(original[80]);
  });
});
