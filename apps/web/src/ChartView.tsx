import { CandlestickSeries, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";

import type { Bar } from "./api";

type Props = {
  bars: Bar[];
  selected: Bar | null;
  visibleBars: Bar[];
  onSelect: (bar: Bar) => void;
};

function toTime(timestamp: string): UTCTimestamp {
  return Math.floor(new Date(timestamp).getTime() / 1000) as UTCTimestamp;
}

export function ChartView({ bars, selected, visibleBars, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const chartData = useMemo(() => visibleBars.map((bar) => ({
    time: toTime(bar.timestamp),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close
  })), [visibleBars]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: "#0f1419" }, textColor: "#c8d0dc" },
      grid: { vertLines: { color: "#1f2935" }, horzLines: { color: "#1f2935" } },
      rightPriceScale: { borderColor: "#2a3442" },
      timeScale: { borderColor: "#2a3442", timeVisible: true }
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#33c7a0",
      downColor: "#e56b6f",
      borderUpColor: "#33c7a0",
      borderDownColor: "#e56b6f",
      wickUpColor: "#8ee6d3",
      wickDownColor: "#f2a1a3"
    });
    chart.subscribeClick((event) => {
      if (!event.time) return;
      const clicked = bars.find((bar) => toTime(bar.timestamp) === event.time);
      if (clicked) onSelect(clicked);
    });
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    return () => chart.remove();
  }, [bars, onSelect]);

  useEffect(() => {
    candleSeriesRef.current?.setData(chartData);
    chartRef.current?.timeScale().fitContent();
  }, [chartData]);

  return (
    <section className="chart-shell" aria-label="Focused candlestick chart">
      <div ref={containerRef} className="chart-view" />
      {selected ? (
        <div className="selected-marker">
          Selected {selected.ticker} {selected.timeframe} {selected.timestamp.slice(0, 10)} C {selected.close.toFixed(2)}
        </div>
      ) : null}
    </section>
  );
}
