import { describe, expect, it } from "vitest";

import { buildSmioFeatures, buildStochRsiFeatures, buildVwapFeatures, buildWilliamsVixFixFeatures } from "./indicators";
import type { Bar } from "./schema";

describe("buildWilliamsVixFixFeatures", () => {
  it("matches the CM_WVF_V3_Ult configured formula fields", () => {
    const bars = Array.from({ length: 60 }, (_, index) => bar(index, {
      open: 100 - index * 0.45,
      high: 101 - index * 0.45,
      low: index === 58 ? 58 : 99 - index * 0.45,
      close: index === 59 ? 76 : 100 - index * 0.45
    }));

    const features = buildWilliamsVixFixFeatures(bars);

    expect(features.wvf).toBeCloseTo(12.605548854041015, 6);
    expect(features.wvfUpperBand).toBeCloseTo(20.959456907413102, 6);
    expect(features.wvfRangeHigh).toBeNull();
    expect(features.wvfIsExtreme).toBe(false);
    expect(features.wvfWasExtremeNowFalse).toBe(true);
    expect(features.wvfFilteredEntry).toBe(true);
    expect(features.wvfAggressiveFilteredEntry).toBe(false);
  });

  it("keeps WVF unavailable until the configured 22-bar lookback exists", () => {
    const features = buildWilliamsVixFixFeatures(Array.from({ length: 21 }, (_, index) => bar(index)));

    expect(features.wvf).toBeNull();
    expect(features.wvfIsExtreme).toBe(false);
  });
});

describe("buildSmioFeatures", () => {
  it("matches the configured SMIO oscillator formula", () => {
    const bars = Array.from({ length: 80 }, (_, index) => bar(index, {
      close: 100 + Math.sin(index / 4) * 2 + index * 0.05
    }));

    const features = buildSmioFeatures(bars);

    expect(features.smioSmi).toBeCloseTo(0.19992874089528323, 6);
    expect(features.smioSignal).toBeCloseTo(0.08670119320622248, 6);
    expect(features.smioOscillator).toBeCloseTo(0.11322754768906075, 6);
  });
});

describe("buildStochRsiFeatures", () => {
  it("uses SMIO as the RSI source with K 7, D 10, RSI 14, stochastic 15", () => {
    const bars = Array.from({ length: 150 }, (_, index) => bar(index, {
      close: 100 + Math.sin(index / 4) * 2 + index * 0.05
    }));

    const features = buildStochRsiFeatures(bars);

    expect(features.stochRsiK).toBeCloseTo(19.741982628364536, 6);
    expect(features.stochRsiD).toBeCloseTo(8.97268990175402, 6);
  });
});

describe("buildVwapFeatures", () => {
  it("uses monthly anchored hlc3 VWAP with one standard deviation band", () => {
    const bars = [
      bar(0, { timestamp: "2024-01-31T18:30:00.000Z", high: 12, low: 8, close: 10, volume: 100 }),
      bar(1, { timestamp: "2024-02-01T14:30:00.000Z", high: 11, low: 9, close: 10, volume: 100 }),
      bar(2, { timestamp: "2024-02-01T18:30:00.000Z", high: 14, low: 10, close: 12, volume: 300 })
    ];

    const features = buildVwapFeatures(bars);

    expect(features.vwap).toBeCloseTo(11.5, 6);
    expect(features.vwapUpperBand1).toBeCloseTo(12.36602540378444, 6);
    expect(features.vwapLowerBand1).toBeCloseTo(10.63397459621556, 6);
    expect(features.distanceToVwapPct).toBeCloseTo(4.3478260869565215, 6);
  });
});

function bar(index: number, overrides: Partial<Bar> = {}): Bar {
  return {
    ticker: "SOXL",
    timeframe: "4H",
    timestamp: new Date(Date.UTC(2024, 0, 1, 14 + index)).toISOString(),
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 1000,
    source: "test",
    adjusted: 1,
    ...overrides
  };
}
