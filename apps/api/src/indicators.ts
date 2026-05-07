import { getBars } from "./bars";
import type { Bar, ChartTimeframe, Ticker } from "./schema";

type Features = Record<string, number | string | boolean | null>;

const wvfConfig = {
  pd: 22,
  bbl: 20,
  mult: 2,
  lb: 50,
  ph: 0.85,
  ltLB: 40,
  mtLB: 14,
  str: 3
} as const;

const smioConfig = {
  longLength: 20,
  shortLength: 20,
  signalLength: 10
} as const;

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

function highest(values: number[], period: number): number | null {
  if (values.length < period) return null;
  return Math.max(...values.slice(-period));
}

function stdev(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const mean = slice.reduce((sum, value) => sum + value, 0) / period;
  return Math.sqrt(slice.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period);
}

function ema(values: number[], period: number): number | null {
  if (values.length === 0) return null;
  const k = 2 / (period + 1);
  return values.reduce((prev, value, index) => (index === 0 ? value : value * k + prev * (1 - k)), values[0]);
}

function emaSeries(values: number[], period: number): Array<number | null> {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const result: Array<number | null> = [];
  let previous: number | null = null;
  for (const value of values) {
    previous = previous === null ? value : value * k + previous * (1 - k);
    result.push(previous);
  }
  return result.map((value, index) => index + 1 < period ? null : value);
}

function compactSeries(values: Array<number | null>): number[] {
  return values.filter((value): value is number => value !== null);
}

function atr(bars: Bar[], period: number): number | null {
  if (bars.length < 2) return null;
  const ranges = bars.slice(1).map((bar, index) => {
    const previousClose = bars[index].close;
    return Math.max(bar.high - bar.low, Math.abs(bar.high - previousClose), Math.abs(bar.low - previousClose));
  });
  return sma(ranges, Math.min(period, ranges.length));
}

function percentChange(values: number[], period: number): number | null {
  if (values.length <= period) return null;
  const previous = values[values.length - period - 1];
  const current = values.at(-1) ?? previous;
  return previous === 0 ? null : ((current - previous) / previous) * 100;
}

function stochRsi(values: number[]): { k: number | null; d: number | null } {
  if (values.length < 15) return { k: null, d: null };
  const changes = values.slice(1).map((value, index) => value - values[index]);
  const gains = changes.map((value) => Math.max(0, value));
  const losses = changes.map((value) => Math.max(0, -value));
  const avgGain = sma(gains, 14) ?? 0;
  const avgLoss = sma(losses, 14) ?? 0;
  const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  const recent = values.slice(-14);
  const low = Math.min(...recent);
  const high = Math.max(...recent);
  const k = high === low ? 50 : ((values.at(-1)! - low) / (high - low)) * 100;
  return { k: Number(((k + rsi) / 2).toFixed(4)), d: Number(k.toFixed(4)) };
}

function closeRank(close: number, low: number, high: number): number | null {
  if (high === low) return null;
  return (close - low) / (high - low);
}

function latestAtOrBefore(ticker: Ticker, timeframe: ChartTimeframe, timestamp: string): Bar | null {
  return [...getBars(ticker, timeframe)].reverse().find((bar) => bar.timestamp <= timestamp) ?? null;
}

export function buildWilliamsVixFixFeatures(bars: Bar[]): Features {
  const closes = bars.map((item) => item.close);
  const wvfValues = bars.map((bar, index) => {
    const highestClose = highest(closes.slice(0, index + 1), wvfConfig.pd);
    return highestClose && highestClose !== 0 ? ((highestClose - bar.low) / highestClose) * 100 : null;
  });
  const currentWvf = wvfValues.at(-1) ?? null;
  const previousWvf = wvfValues.at(-2) ?? null;
  const numericWvfValues = wvfValues.filter((value): value is number => value !== null);
  const sDev = stdev(numericWvfValues, wvfConfig.bbl);
  const midLine = sma(numericWvfValues, wvfConfig.bbl);
  const upperBand = midLine !== null && sDev !== null ? midLine + wvfConfig.mult * sDev : null;
  const rangeHighBase = highest(numericWvfValues, wvfConfig.lb);
  const rangeHigh = rangeHighBase === null ? null : rangeHighBase * wvfConfig.ph;
  const previousNumericWvfValues = wvfValues.slice(0, -1).filter((value): value is number => value !== null);
  const previousSDev = stdev(previousNumericWvfValues, wvfConfig.bbl);
  const previousMidLine = sma(previousNumericWvfValues, wvfConfig.bbl);
  const previousUpperBand = previousMidLine !== null && previousSDev !== null ? previousMidLine + wvfConfig.mult * previousSDev : null;
  const previousRangeHighBase = highest(previousNumericWvfValues, wvfConfig.lb);
  const previousRangeHigh = previousRangeHighBase === null ? null : previousRangeHighBase * wvfConfig.ph;
  const bar = bars.at(-1);
  const previousBar = bars.at(-2);
  const strengthBar = bars.at(-(wvfConfig.str + 1));
  const longTermBar = bars.at(-(wvfConfig.ltLB + 1));
  const mediumTermBar = bars.at(-(wvfConfig.mtLB + 1));
  const wasExtreme = previousWvf !== null && (
    (previousUpperBand !== null && previousWvf >= previousUpperBand) ||
    (previousRangeHigh !== null && previousWvf >= previousRangeHigh)
  );
  const isExtreme = currentWvf !== null && (
    (upperBand !== null && currentWvf >= upperBand) ||
    (rangeHigh !== null && currentWvf >= rangeHigh)
  );
  const filtered = wasExtreme && !isExtreme;
  const filteredAggressive = wasExtreme && !filtered;
  const upRange = Boolean(bar && previousBar && bar.low > previousBar.low && bar.close > previousBar.high);
  const upRangeAggressive = Boolean(bar && previousBar && bar.close > previousBar.close && bar.close > previousBar.open);
  const strengthConfirmed = Boolean(bar && strengthBar && bar.close > strengthBar.close);
  const downTrendConfirmed = Boolean(bar && (
    (longTermBar && bar.close < longTermBar.close) ||
    (mediumTermBar && bar.close < mediumTermBar.close)
  ));
  const alert3 = upRange && strengthConfirmed && downTrendConfirmed && filtered;
  const alert4 = upRangeAggressive && strengthConfirmed && downTrendConfirmed && filteredAggressive;

  return {
    wvf: currentWvf,
    wvfMidLine: midLine,
    wvfUpperBand: upperBand,
    wvfRangeHigh: rangeHigh,
    wvfIsExtreme: isExtreme,
    wvfWasExtremeNowFalse: filtered,
    wvfFilteredEntry: alert3,
    wvfAggressiveFilteredEntry: alert4
  };
}

export function buildSmioFeatures(bars: Bar[]): Features {
  if (bars.length < 2) {
    return { smioSmi: null, smioSignal: null, smioOscillator: null };
  }
  const changes = bars.slice(1).map((bar, index) => bar.close - bars[index].close);
  const absChanges = changes.map((value) => Math.abs(value));
  const shortChange = compactSeries(emaSeries(changes, smioConfig.shortLength));
  const shortAbsChange = compactSeries(emaSeries(absChanges, smioConfig.shortLength));
  const longChange = emaSeries(shortChange, smioConfig.longLength);
  const longAbsChange = emaSeries(shortAbsChange, smioConfig.longLength);
  const smiValues = longChange.map((value, index) => {
    const absValue = longAbsChange[index];
    return value === null || absValue === null || absValue === 0 ? null : value / absValue;
  });
  const signalValues = emaSeries(compactSeries(smiValues), smioConfig.signalLength);
  const smi = smiValues.at(-1) ?? null;
  const signal = signalValues.at(-1) ?? null;
  return {
    smioSmi: smi,
    smioSignal: signal,
    smioOscillator: smi !== null && signal !== null ? smi - signal : null
  };
}

export function buildFeatures(ticker: Ticker, timeframe: ChartTimeframe, timestamp: string): Features {
  const bars = getBars(ticker, timeframe).filter((bar) => bar.timestamp <= timestamp);
  const bar = bars.at(-1);
  if (!bar) return {};

  const closes = bars.map((item) => item.close);
  const ema25 = ema(closes, Math.min(25, closes.length));
  const sma100 = sma(closes, Math.min(100, closes.length));
  const atr14 = atr(bars, 14);
  const stoch = stochRsi(closes);
  const recent20 = bars.slice(-20);
  const recent20High = Math.max(...recent20.map((item) => item.high));
  const recent20Low = Math.min(...recent20.map((item) => item.low));
  const pairedTicker: Ticker = ticker === "SOXL" ? "SOXS" : "SOXL";
  const paired = latestAtOrBefore(pairedTicker, timeframe, timestamp);
  const mtf = (["1D", "4H", "2H"] as ChartTimeframe[]).reduce<Features>((acc, tf) => {
    const mtfBar = latestAtOrBefore(ticker, tf, timestamp);
    const mtfBars = getBars(ticker, tf).filter((item) => item.timestamp <= timestamp);
    const mtfEma = ema(mtfBars.map((item) => item.close), Math.min(25, mtfBars.length));
    const prefix = tf === "1D" ? "d1" : tf === "4H" ? "h4" : "h2";
    acc[`${prefix}Close`] = mtfBar?.close ?? null;
    acc[`${prefix}CloseAboveEma25`] = mtfBar && mtfEma !== null ? mtfBar.close > mtfEma : null;
    return acc;
  }, {});

  return {
    close: bar.close,
    volume: bar.volume,
    ema25,
    sma100,
    atr14,
    stochRsiK: stoch.k,
    stochRsiD: stoch.d,
    closeAboveEma25: ema25 === null ? null : bar.close > ema25,
    closeAboveSma100: sma100 === null ? null : bar.close > sma100,
    distanceToEma25Pct: ema25 ? ((bar.close - ema25) / ema25) * 100 : null,
    distanceToSma100Pct: sma100 ? ((bar.close - sma100) / sma100) * 100 : null,
    recent5ReturnPct: percentChange(closes, 5),
    recent10ReturnPct: percentChange(closes, 10),
    recent20ReturnPct: percentChange(closes, 20),
    recent20High,
    recent20Low,
    closeRankRecent20: closeRank(bar.close, recent20Low, recent20High),
    pairedTicker,
    pairedClose: paired?.close ?? null,
    pairRatioClose: paired?.close ? bar.close / paired.close : null,
    ...buildWilliamsVixFixFeatures(bars),
    ...buildSmioFeatures(bars),
    ...mtf
  };
}
