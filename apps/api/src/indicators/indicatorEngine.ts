import type { AggregatedBar } from "../aggregation/aggregateBars.js";
import {
  ema,
  highest,
  rma,
  sma,
  stochRsi,
  tsi
} from "./series.js";
import type { NullableSeries } from "./series.js";

export type SmioSnapshot = {
  erg: number | null;
  signal: number | null;
  oscillator: number | null;
};

export type StochRsiSnapshot = {
  rsi: number | null;
  stoch: number | null;
  k: number | null;
  d: number | null;
};

export type CmWvfSnapshot = {
  wvf: number | null;
  plot: number | null;
  upperBand: number | null;
  rangeHigh: number | null;
  filtered: boolean;
  filteredAggressive: boolean;
  alert1: boolean;
  alert2: boolean;
  alert3: boolean;
  alert4: boolean;
};

export type IndicatorSnapshot = {
  ticker: string;
  timeframe: string;
  timestamp: string;
  volume: number;
  volumeSma20: number | null;
  ema25: number | null;
  sma100: number | null;
  monthlyVwap: number | null;
  atr14Rma: number | null;
  smio: SmioSnapshot;
  stochRsi: StochRsiSnapshot;
  cmWvf: CmWvfSnapshot;
};

function trueRanges(bars: AggregatedBar[]): number[] {
  return bars.map((bar, index) => {
    if (index === 0) {
      return bar.high - bar.low;
    }

    const previousClose = bars[index - 1].close;
    return Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - previousClose),
      Math.abs(bar.low - previousClose)
    );
  });
}

function monthlyVwap(bars: AggregatedBar[]): NullableSeries {
  const result: NullableSeries = Array(bars.length).fill(null);
  let currentMonth = "";
  let cumulativeTypicalVolume = 0;
  let cumulativeVolume = 0;

  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index];
    const month = bar.timestamp.slice(0, 7);

    if (month !== currentMonth) {
      currentMonth = month;
      cumulativeTypicalVolume = 0;
      cumulativeVolume = 0;
    }

    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    cumulativeTypicalVolume += typicalPrice * bar.volume;
    cumulativeVolume += bar.volume;
    result[index] = cumulativeVolume === 0 ? null : cumulativeTypicalVolume / cumulativeVolume;
  }

  return result;
}

function nullableDifference(left: NullableSeries, right: NullableSeries): NullableSeries {
  return left.map((value, index) => {
    const other = right[index];
    return value === null || other === null ? null : value - other;
  });
}

function emaFromNullable(values: NullableSeries, length: number): NullableSeries {
  const numericValues: number[] = [];
  const numericIndexes: number[] = [];

  values.forEach((value, index) => {
    if (value !== null) {
      numericValues.push(value);
      numericIndexes.push(index);
    }
  });

  const computed = ema(numericValues, length);
  const result: NullableSeries = Array(values.length).fill(null);
  computed.forEach((value, index) => {
    result[numericIndexes[index]] = value;
  });

  return result;
}

function computeSmio(closes: number[]): SmioSnapshot[] {
  const erg = tsi(closes, {
    shortLength: 20,
    longLength: 20
  });
  const signal = emaFromNullable(erg, 10);
  const oscillator = nullableDifference(erg, signal);

  return closes.map((_, index) => ({
    erg: erg[index],
    signal: signal[index],
    oscillator: oscillator[index]
  }));
}

function valueAt(values: NullableSeries, index: number): number | null {
  return values[index] ?? null;
}

function rollingMeanNullable(values: NullableSeries, length: number): NullableSeries {
  const result: NullableSeries = Array(values.length).fill(null);

  for (let index = length - 1; index < values.length; index += 1) {
    const window = values.slice(index - length + 1, index + 1);
    if (window.every((value) => value !== null)) {
      const numbers = window as number[];
      result[index] = numbers.reduce((sum, value) => sum + value, 0) / length;
    }
  }

  return result;
}

function rollingStdNullable(values: NullableSeries, length: number): NullableSeries {
  const result: NullableSeries = Array(values.length).fill(null);

  for (let index = length - 1; index < values.length; index += 1) {
    const window = values.slice(index - length + 1, index + 1);
    if (window.every((value) => value !== null)) {
      const numbers = window as number[];
      const mean = numbers.reduce((sum, value) => sum + value, 0) / length;
      const variance =
        numbers.reduce((sum, value) => sum + (value - mean) ** 2, 0) / length;
      result[index] = Math.sqrt(variance);
    }
  }

  return result;
}

function rollingHighestNullable(values: NullableSeries, length: number): NullableSeries {
  const result: NullableSeries = Array(values.length).fill(null);

  for (let index = length - 1; index < values.length; index += 1) {
    const window = values.slice(index - length + 1, index + 1);
    if (window.every((value) => value !== null)) {
      result[index] = Math.max(...(window as number[]));
    }
  }

  return result;
}

function computeCmWvf(bars: AggregatedBar[]): CmWvfSnapshot[] {
  const pd = 22;
  const bbl = 20;
  const mult = 2;
  const lb = 50;
  const ph = 0.85;
  const ltLB = 40;
  const mtLB = 14;
  const strength = 3;
  const closes = bars.map((bar) => bar.close);
  const lows = bars.map((bar) => bar.low);
  const highestClose = highest(closes, pd);
  const wvf: NullableSeries = bars.map((_, index) => {
    const highClose = highestClose[index];
    if (highClose === null || highClose === 0) {
      return null;
    }

    return ((highClose - lows[index]) / highClose) * 100;
  });
  const midLine = rollingMeanNullable(wvf, bbl);
  const sDev = rollingStdNullable(wvf, bbl).map((value) =>
    value === null ? null : value * mult
  );
  const upperBand = midLine.map((value, index) => {
    const deviation = sDev[index];
    return value === null || deviation === null ? null : value + deviation;
  });
  const rangeHigh = rollingHighestNullable(wvf, lb).map((value) =>
    value === null ? null : value * ph
  );

  return bars.map((bar, index) => {
    const currentWvf = valueAt(wvf, index);
    const currentUpperBand = valueAt(upperBand, index);
    const currentRangeHigh = valueAt(rangeHigh, index);
    const previousWvf = index > 0 ? valueAt(wvf, index - 1) : null;
    const previousUpperBand = index > 0 ? valueAt(upperBand, index - 1) : null;
    const previousRangeHigh = index > 0 ? valueAt(rangeHigh, index - 1) : null;
    const previousWasTrue =
      previousWvf !== null &&
      ((previousUpperBand !== null && previousWvf >= previousUpperBand) ||
        (previousRangeHigh !== null && previousWvf >= previousRangeHigh));
    const isTrue =
      currentWvf !== null &&
      ((currentUpperBand !== null && currentWvf >= currentUpperBand) ||
        (currentRangeHigh !== null && currentWvf >= currentRangeHigh));
    const noLongerTrue =
      currentWvf !== null &&
      (currentUpperBand === null || currentWvf < currentUpperBand) &&
      (currentRangeHigh === null || currentWvf < currentRangeHigh);
    const filtered = previousWasTrue && noLongerTrue;
    const filteredAggressive = previousWasTrue && !noLongerTrue;
    const upRange =
      index > 0 ? bar.low > bars[index - 1].low && bar.close > bars[index - 1].high : false;
    const upRangeAggressive =
      index > 0 ? bar.close > bars[index - 1].close && bar.close > bars[index - 1].open : false;
    const closeAboveStrength = index >= strength ? bar.close > bars[index - strength].close : false;
    const closeBelowLong = index >= ltLB ? bar.close < bars[index - ltLB].close : false;
    const closeBelowMedium = index >= mtLB ? bar.close < bars[index - mtLB].close : false;
    const downTrendFilter = closeBelowLong || closeBelowMedium;

    return {
      wvf: currentWvf,
      plot: currentWvf === null ? null : currentWvf * -1,
      upperBand: currentUpperBand,
      rangeHigh: currentRangeHigh,
      filtered,
      filteredAggressive,
      alert1: isTrue,
      alert2: filtered,
      alert3: upRange && closeAboveStrength && downTrendFilter && filtered,
      alert4: upRangeAggressive && closeAboveStrength && downTrendFilter && filteredAggressive
    };
  });
}

export function computeIndicatorSnapshots(bars: AggregatedBar[]): IndicatorSnapshot[] {
  const closes = bars.map((bar) => bar.close);
  const volumes = bars.map((bar) => bar.volume);
  const volumeSma20 = sma(volumes, 20);
  const ema25 = ema(closes, 25);
  const sma100 = sma(closes, 100);
  const vwapMonth = monthlyVwap(bars);
  const atr14Rma = rma(trueRanges(bars), 14);
  const smio = computeSmio(closes);
  const stoch = stochRsi(closes, {
    rsiLength: 7,
    stochLength: 10,
    kSmoothing: 14,
    dSmoothing: 15
  });
  const cmWvf = computeCmWvf(bars);

  return bars.map((bar, index) => ({
    ticker: bar.ticker,
    timeframe: bar.timeframe,
    timestamp: bar.timestamp,
    volume: bar.volume,
    volumeSma20: volumeSma20[index],
    ema25: ema25[index],
    sma100: sma100[index],
    monthlyVwap: vwapMonth[index],
    atr14Rma: atr14Rma[index],
    smio: smio[index],
    stochRsi: {
      rsi: stoch.rsi[index],
      stoch: stoch.stoch[index],
      k: stoch.k[index],
      d: stoch.d[index]
    },
    cmWvf: cmWvf[index]
  }));
}
