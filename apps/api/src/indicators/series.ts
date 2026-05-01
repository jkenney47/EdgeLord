export type NullableSeries = Array<number | null>;

function assertPositiveLength(length: number): void {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error(`Length must be a positive integer: ${length}`);
  }
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function sma(values: number[], length: number): NullableSeries {
  assertPositiveLength(length);
  const result: NullableSeries = Array(values.length).fill(null);
  let sum = 0;

  for (let index = 0; index < values.length; index += 1) {
    sum += values[index];

    if (index >= length) {
      sum -= values[index - length];
    }

    if (index >= length - 1) {
      result[index] = sum / length;
    }
  }

  return result;
}

export function ema(values: number[], length: number): NullableSeries {
  assertPositiveLength(length);
  const result: NullableSeries = Array(values.length).fill(null);

  if (values.length < length) {
    return result;
  }

  const multiplier = 2 / (length + 1);
  let previous = average(values.slice(0, length));
  result[length - 1] = previous;

  for (let index = length; index < values.length; index += 1) {
    previous = (values[index] - previous) * multiplier + previous;
    result[index] = previous;
  }

  return result;
}

export function rma(values: number[], length: number): NullableSeries {
  assertPositiveLength(length);
  const result: NullableSeries = Array(values.length).fill(null);

  if (values.length < length) {
    return result;
  }

  let previous = average(values.slice(0, length));
  result[length - 1] = previous;

  for (let index = length; index < values.length; index += 1) {
    previous = (previous * (length - 1) + values[index]) / length;
    result[index] = previous;
  }

  return result;
}

export function standardDeviation(values: number[], length: number): NullableSeries {
  assertPositiveLength(length);
  const result: NullableSeries = Array(values.length).fill(null);

  for (let index = length - 1; index < values.length; index += 1) {
    const window = values.slice(index - length + 1, index + 1);
    const mean = average(window);
    const variance = average(window.map((value) => (value - mean) ** 2));
    result[index] = Math.sqrt(variance);
  }

  return result;
}

export function highest(values: number[], length: number): NullableSeries {
  assertPositiveLength(length);
  const result: NullableSeries = Array(values.length).fill(null);

  for (let index = length - 1; index < values.length; index += 1) {
    result[index] = Math.max(...values.slice(index - length + 1, index + 1));
  }

  return result;
}

export function lowest(values: number[], length: number): NullableSeries {
  assertPositiveLength(length);
  const result: NullableSeries = Array(values.length).fill(null);

  for (let index = length - 1; index < values.length; index += 1) {
    result[index] = Math.min(...values.slice(index - length + 1, index + 1));
  }

  return result;
}

export function rsi(values: number[], length: number): NullableSeries {
  assertPositiveLength(length);
  const result: NullableSeries = Array(values.length).fill(null);

  if (values.length <= length) {
    return result;
  }

  let gainSum = 0;
  let lossSum = 0;

  for (let index = 1; index <= length; index += 1) {
    const change = values[index] - values[index - 1];
    gainSum += Math.max(change, 0);
    lossSum += Math.max(-change, 0);
  }

  let averageGain = gainSum / length;
  let averageLoss = lossSum / length;

  for (let index = length; index < values.length; index += 1) {
    if (index > length) {
      const change = values[index] - values[index - 1];
      averageGain = (averageGain * (length - 1) + Math.max(change, 0)) / length;
      averageLoss = (averageLoss * (length - 1) + Math.max(-change, 0)) / length;
    }

    if (averageLoss === 0) {
      result[index] = 100;
    } else {
      const relativeStrength = averageGain / averageLoss;
      result[index] = 100 - 100 / (1 + relativeStrength);
    }
  }

  return result;
}

function smaNullable(values: NullableSeries, length: number): NullableSeries {
  assertPositiveLength(length);
  const result: NullableSeries = Array(values.length).fill(null);

  for (let index = length - 1; index < values.length; index += 1) {
    const window = values.slice(index - length + 1, index + 1);
    if (window.every((value) => value !== null)) {
      result[index] = average(window as number[]);
    }
  }

  return result;
}

export type StochRsiOptions = {
  rsiLength: number;
  stochLength: number;
  kSmoothing: number;
  dSmoothing: number;
};

export type StochRsiResult = {
  rsi: NullableSeries;
  stoch: NullableSeries;
  k: NullableSeries;
  d: NullableSeries;
};

export function stochRsi(values: number[], options: StochRsiOptions): StochRsiResult {
  const rsiValues = rsi(values, options.rsiLength);
  const stoch: NullableSeries = Array(values.length).fill(null);

  for (let index = options.stochLength - 1; index < rsiValues.length; index += 1) {
    const window = rsiValues.slice(index - options.stochLength + 1, index + 1);
    if (!window.every((value) => value !== null)) {
      continue;
    }

    const numericWindow = window as number[];
    const min = Math.min(...numericWindow);
    const max = Math.max(...numericWindow);
    stoch[index] = max === min ? 0 : ((rsiValues[index] as number) - min) / (max - min) * 100;
  }

  const k = smaNullable(stoch, options.kSmoothing);
  const d = smaNullable(k, options.dSmoothing);

  return {
    rsi: rsiValues,
    stoch,
    k,
    d
  };
}

function emaNullable(values: NullableSeries, length: number): NullableSeries {
  assertPositiveLength(length);
  const result: NullableSeries = Array(values.length).fill(null);
  const multiplier = 2 / (length + 1);
  let previous: number | null = null;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === null) {
      continue;
    }

    if (previous === null) {
      const seedWindow = values.slice(index, index + length);
      if (seedWindow.length < length || !seedWindow.every((entry) => entry !== null)) {
        continue;
      }

      previous = average(seedWindow as number[]);
      result[index + length - 1] = previous;
      index += length - 1;
      continue;
    }

    previous = (value - previous) * multiplier + previous;
    result[index] = previous;
  }

  return result;
}

export type TsiOptions = {
  shortLength: number;
  longLength: number;
};

export function tsi(values: number[], options: TsiOptions): NullableSeries {
  const momentum: NullableSeries = values.map((value, index) =>
    index === 0 ? null : value - values[index - 1]
  );
  const absoluteMomentum = momentum.map((value) => (value === null ? null : Math.abs(value)));
  const smoothedMomentum = emaNullable(
    emaNullable(momentum, options.longLength),
    options.shortLength
  );
  const smoothedAbsoluteMomentum = emaNullable(
    emaNullable(absoluteMomentum, options.longLength),
    options.shortLength
  );

  return smoothedMomentum.map((value, index) => {
    const denominator = smoothedAbsoluteMomentum[index];
    if (value === null || denominator === null || denominator === 0) {
      return null;
    }

    return (value / denominator) * 100;
  });
}
