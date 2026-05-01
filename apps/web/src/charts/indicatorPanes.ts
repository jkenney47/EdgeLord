import type { IndicatorSnapshot } from "../api/client";

function formatNumber(value: number | null, digits = 2): string {
  return value === null ? "warming" : value.toFixed(digits);
}

function latestValue<T>(items: T[], selector: (item: T) => number | null): number | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const value = selector(items[index]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

export type IndicatorPane = {
  kind: "histogram" | "line" | "dual-line";
  className?: string;
  label: string;
  value: string;
  valueParts?: Array<{
    text: string;
    tone?: "default" | "green" | "red" | "yellow" | "gray";
  }>;
  values: Array<number | null>;
  histogramToneValues?: Array<"positive" | "negative" | "cm-wvf-active" | "cm-wvf-muted" | null>;
  secondaryValues?: Array<number | null>;
  scaleMode?: "auto" | "zero" | "bounded";
  bounds?: {
    min: number;
    max: number;
  };
  referenceLines?: Array<{
    value: number;
    label?: string;
  }>;
  referenceBands?: Array<{
    from: number;
    to: number;
  }>;
};

export function indicatorPanes(indicators: IndicatorSnapshot[]): IndicatorPane[] {
  const latest = indicators.at(-1) ?? null;

  return [
    {
      kind: "histogram",
      className: "smio-pane",
      label: "SMIO 20 20 10",
      value: latest ? formatNumber(latest.smio.oscillator, 4) : "warming",
      valueParts: [{ text: latest ? formatNumber(latest.smio.oscillator, 4) : "warming" }],
      values: indicators.map((indicator) => indicator.smio.oscillator),
      scaleMode: "zero",
      referenceLines: [{ value: 0 }]
    },
    {
      kind: "dual-line",
      className: "stoch-rsi-pane",
      label: "Stoch RSI 7 10 14 15",
      value: latest
        ? `${formatNumber(latest.stochRsi.k)} / ${formatNumber(latest.stochRsi.d)}`
        : "warming / warming",
      valueParts: latest
        ? [
            { text: formatNumber(latest.stochRsi.k), tone: "green" },
            { text: formatNumber(latest.stochRsi.d), tone: "red" }
          ]
        : [{ text: "warming / warming", tone: "gray" }],
      values: indicators.map((indicator) => indicator.stochRsi.k),
      secondaryValues: indicators.map((indicator) => indicator.stochRsi.d),
      scaleMode: "bounded",
      bounds: { min: 0, max: 100 },
      referenceLines: [
        { value: 80, label: "80" },
        { value: 20, label: "20" }
      ],
      referenceBands: [{ from: 20, to: 80 }]
    },
    {
      kind: "histogram",
      className: "cm-wvf-pane",
      label: "CM_WVF_V3_Ult 22 20 2 50 0.85 40 14 3",
      value: latest ? formatNumber(latest.cmWvf.plot) : "warming",
      valueParts: latest
        ? [
            { text: formatNumber(latest.cmWvf.plot), tone: "gray" },
            { text: "0.0000", tone: "green" },
            { text: "...", tone: "gray" }
          ]
        : [{ text: "warming", tone: "gray" }],
      values: indicators.map((indicator) => indicator.cmWvf.plot),
      histogramToneValues: indicators.map((indicator) =>
        indicator.cmWvf.plot === null ? null : indicator.cmWvf.alert1 ? "cm-wvf-active" : "cm-wvf-muted"
      ),
      scaleMode: "zero",
      referenceLines: [{ value: 0 }]
    },
    {
      kind: "line",
      className: "atr-pane",
      label: "ATR 14 RMA",
      value: formatNumber(latestValue(indicators, (indicator) => indicator.atr14Rma)),
      valueParts: [
        { text: formatNumber(latestValue(indicators, (indicator) => indicator.atr14Rma)) }
      ],
      values: indicators.map((indicator) => indicator.atr14Rma),
      scaleMode: "auto"
    }
  ];
}

export function overlaySummary(indicator: IndicatorSnapshot | null): string {
  if (!indicator) {
    return "EMA 25 warming / SMA 100 warming / VWAP warming";
  }

  return `EMA 25 ${formatNumber(indicator.ema25)} / SMA 100 ${formatNumber(
    indicator.sma100
  )} / VWAP ${formatNumber(indicator.monthlyVwap)}`;
}
