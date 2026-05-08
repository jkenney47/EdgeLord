import { CandlestickSeries, createChart, type IChartApi, type ISeriesApi, type Time, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";

import type { Bar } from "./api";
import { formatEasternTime } from "./timeFormat";

type Props = {
  selected: Bar | null;
  visibleBars: Bar[];
  onSelect: (bar: Bar) => void;
  onHover: (bar: Bar | null) => void;
};

function toTime(timestamp: string): UTCTimestamp {
  return Math.floor(new Date(timestamp).getTime() / 1000) as UTCTimestamp;
}

function formatChartTime(time: Time): string {
  return formatEasternTime(Number(time));
}

export function findBarForChartTime(bars: Bar[], time: Time | undefined): Bar | null {
  if (!time) return null;
  const timestamp = Number(time);
  if (!Number.isFinite(timestamp)) return null;
  return bars.find((bar) => toTime(bar.timestamp) === timestamp) ?? null;
}

export function ChartView({ selected, visibleBars, onSelect, onHover }: Props) {
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
      localization: {
        timeFormatter: formatChartTime
      },
      timeScale: {
        borderColor: "#2a3442",
        timeVisible: true,
        tickMarkFormatter: () => ""
      }
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
      const clicked = findBarForChartTime(visibleBars, event.time);
      if (clicked) onSelect(clicked);
    });
    chart.subscribeCrosshairMove((event) => {
      const hovered = findBarForChartTime(visibleBars, event.time);
      if (!hovered) {
        onHover(null);
        return;
      }
      onHover(hovered);
    });
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    return () => {
      onHover(null);
      chart.remove();
    };
  }, [onHover, onSelect, visibleBars]);

  useEffect(() => {
    candleSeriesRef.current?.setData(chartData);
    chartRef.current?.timeScale().fitContent();
  }, [chartData]);

  return (
    <section className="chart-shell" aria-label="Focused candlestick chart">
      <div ref={containerRef} className="chart-view" />
      {selected ? (
        <div className="selected-marker">
          Selected {selected.ticker} {selected.timeframe} C {selected.close.toFixed(2)}
        </div>
      ) : null}
    </section>
  );
}
