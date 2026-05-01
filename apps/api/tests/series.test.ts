import { describe, expect, it } from "vitest";

import {
  ema,
  highest,
  lowest,
  rma,
  rsi,
  sma,
  standardDeviation,
  stochRsi,
  tsi
} from "../src/indicators/series.js";

function rounded(values: Array<number | null>, decimals = 4): Array<number | null> {
  return values.map((value) => (value === null ? null : Number(value.toFixed(decimals))));
}

describe("indicator series math", () => {
  it("computes SMA with null warmup values", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it("computes EMA using SMA seed at the first completed period", () => {
    expect(rounded(ema([1, 2, 3, 4, 5], 3))).toEqual([null, null, 2, 3, 4]);
  });

  it("computes RMA using SMA seed then Wilder smoothing", () => {
    expect(rounded(rma([1, 2, 3, 4, 5], 3))).toEqual([null, null, 2, 2.6667, 3.4444]);
  });

  it("computes population standard deviation over a rolling window", () => {
    expect(rounded(standardDeviation([1, 2, 3, 4, 5], 3))).toEqual([
      null,
      null,
      0.8165,
      0.8165,
      0.8165
    ]);
  });

  it("computes rolling highest and lowest values", () => {
    expect(highest([3, 1, 5, 2, 4], 3)).toEqual([null, null, 5, 5, 5]);
    expect(lowest([3, 1, 5, 2, 4], 3)).toEqual([null, null, 1, 1, 2]);
  });

  it("computes RSI with Wilder smoothing", () => {
    expect(rounded(rsi([1, 2, 3, 2, 4, 5], 3))).toEqual([
      null,
      null,
      null,
      66.6667,
      83.3333,
      87.8788
    ]);
  });

  it("computes Stoch RSI K and D series", () => {
    const result = stochRsi([1, 2, 3, 2, 4, 5, 4, 6, 7, 8], {
      rsiLength: 3,
      stochLength: 3,
      kSmoothing: 2,
      dSmoothing: 2
    });

    expect(result.k).toHaveLength(10);
    expect(result.d).toHaveLength(10);
    expect(result.k.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(result.k.some((value) => value !== null)).toBe(true);
    expect(result.d.some((value) => value !== null)).toBe(true);
  });

  it("computes TSI as a bounded momentum oscillator", () => {
    const result = tsi([1, 2, 3, 4, 5, 6, 7], {
      shortLength: 2,
      longLength: 3
    });

    expect(result.slice(0, 4)).toEqual([null, null, null, null]);
    expect(rounded(result.slice(4))).toEqual([100, 100, 100]);
  });
});
