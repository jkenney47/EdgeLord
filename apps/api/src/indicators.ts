import { getBars } from "./bars";
import type { Bar, ChartTimeframe, Ticker } from "./schema";

type Features = Record<string, number | string | boolean | null>;

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

function ema(values: number[], period: number): number | null {
  if (values.length === 0) return null;
  const k = 2 / (period + 1);
  return values.reduce((prev, value, index) => (index === 0 ? value : value * k + prev * (1 - k)), values[0]);
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
    ...mtf
  };
}
