import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart
} from "lightweight-charts";
import type {
  Logical,
  LogicalRange,
  LogicalRangeChangeEventHandler,
  MouseEventParams,
  Time,
  UTCTimestamp
} from "lightweight-charts";
import type { IChartApi } from "lightweight-charts";

import type { ChartCandle, ChartTimeframe, Drawing, DrawingAnchor, TradeEvent } from "../api/client";
import type { ChartInteractionMode } from "../store/useAppStore";

export type LabelIssueSeverity = "warning" | "error";

type LightweightPriceChartProps = {
  candles: ChartCandle[];
  drawings: Drawing[];
  labels: TradeEvent[];
  labelIssueSeverity: Record<string, LabelIssueSeverity>;
  selectedLabelId: string | null;
  selectedDrawingId: string | null;
  ticker: string;
  timeframe: ChartTimeframe;
  selectedTimestamp: string | null;
  hoveredTimestamp: string | null;
  selectedCandleRole: "active" | "related" | null;
  interactionMode: ChartInteractionMode;
  pendingTrendlineAnchor: DrawingAnchor | null;
  onSelectDrawing: (drawingId: string | null) => void;
  onSelectLabel: (label: TradeEvent) => void;
  onSelect: (candle: ChartCandle) => void;
};

const MIN_RENDERED_TRENDLINE_SPAN_PERCENT = 2;
const visibleRangeByChartKey = new Map<string, LogicalRange>();

function priceRange(candles: ChartCandle[]): { min: number; max: number } {
  if (candles.length === 0) {
    return { min: 0, max: 1 };
  }

  return {
    min: Math.min(...candles.map((bar) => bar.low)),
    max: Math.max(...candles.map((bar) => bar.high))
  };
}

function toChartTime(timestamp: string): UTCTimestamp {
  return Math.floor(new Date(timestamp).getTime() / 1000) as UTCTimestamp;
}

function fromChartTime(time: Time): string | null {
  if (typeof time === "number") {
    return new Date(time * 1000).toISOString();
  }

  if (typeof time === "string") {
    return new Date(`${time}T00:00:00.000Z`).toISOString();
  }

  return new Date(Date.UTC(time.year, time.month - 1, time.day)).toISOString();
}

function nearestCandleForTime(candles: ChartCandle[], time: Time | undefined): ChartCandle | null {
  const timestamp = time ? fromChartTime(time) : null;
  if (!timestamp) {
    return null;
  }

  const targetMs = new Date(timestamp).getTime();
  return (
    candles
      .map((candle) => ({
        candle,
        distance: Math.abs(new Date(candle.timestamp).getTime() - targetMs)
      }))
      .sort((left, right) => left.distance - right.distance)[0]?.candle ?? null
  );
}

function formatTickTime(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    timeZone: "America/New_York"
  }).format(new Date(timestamp));
}

function timeTicks(candles: ChartCandle[]): ChartCandle[] {
  if (candles.length <= 2) {
    return candles;
  }

  return [candles[0], candles[Math.floor((candles.length - 1) / 2)], candles[candles.length - 1]];
}

function chartKey(ticker: string, timeframe: ChartTimeframe): string {
  return `${ticker}:${timeframe}`;
}

function clampLogicalRange(range: LogicalRange, candleCount: number): LogicalRange | null {
  if (candleCount <= 0) {
    return null;
  }

  const maxIndex = candleCount - 1;
  const span = Math.max(1, range.to - range.from);
  const from = Math.max(0, Math.min(maxIndex, range.from));
  const to = Math.max(from + 1, Math.min(maxIndex, from + span));

  return { from: from as Logical, to: to as Logical };
}

export function LightweightPriceChart({
  candles,
  drawings,
  labels,
  labelIssueSeverity,
  selectedLabelId,
  selectedDrawingId,
  ticker,
  timeframe,
  selectedTimestamp,
  hoveredTimestamp,
  selectedCandleRole,
  interactionMode,
  pendingTrendlineAnchor,
  onSelectDrawing,
  onSelectLabel,
  onSelect
}: LightweightPriceChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [dragging, setDragging] = useState<{
    drawingId: string;
    anchorIndex: 0 | 1;
  } | null>(null);
  const [dragPreviewAnchor, setDragPreviewAnchor] = useState<DrawingAnchor | null>(null);
  const range = priceRange(candles);
  const spread = Math.max(range.max - range.min, 1);
  const sampledCandles = candles.slice(-120);
  const sampledTimestampSet = useMemo(
    () => new Set(sampledCandles.map((bar) => bar.timestamp)),
    [sampledCandles]
  );
  const labelsByTimestamp = labels.reduce<Record<string, TradeEvent[]>>((accumulator, label) => {
    if (!sampledTimestampSet.has(label.timestamp)) {
      return accumulator;
    }

    accumulator[label.timestamp] = [...(accumulator[label.timestamp] ?? []), label];
    return accumulator;
  }, {});
  const visibleTrendlines = drawings.filter(
    (drawing) =>
      drawing.ticker === ticker &&
      drawing.timeframe === timeframe &&
      drawing.type === "trendline" &&
      drawing.anchors.length >= 2 &&
      drawing.anchors[0].timestamp !== drawing.anchors[1].timestamp &&
      drawing.anchors.every((anchor) => sampledTimestampSet.has(anchor.timestamp))
  );
  const visibleMarkers = drawings.filter(
    (drawing) =>
      drawing.ticker === ticker &&
      drawing.timeframe === timeframe &&
      drawing.type === "breakout_marker" &&
      drawing.anchors.length >= 1 &&
      sampledTimestampSet.has(drawing.anchors[0].timestamp)
  );
  const selectedIndex = selectedTimestamp
    ? sampledCandles.findIndex((bar) => bar.timestamp === selectedTimestamp)
    : -1;
  const selectedCandle = selectedIndex >= 0 ? sampledCandles[selectedIndex] : null;
  const hoveredIndex = hoveredTimestamp
    ? sampledCandles.findIndex((bar) => bar.timestamp === hoveredTimestamp)
    : -1;

  const anchorForDrawing = (drawing: Drawing, anchorIndex: 0 | 1): DrawingAnchor | null => {
    if (dragging?.drawingId === drawing.id && dragging.anchorIndex === anchorIndex && dragPreviewAnchor) {
      return dragPreviewAnchor;
    }

    return drawing.anchors[anchorIndex] ?? null;
  };

  const pointForAnchor = (anchor: DrawingAnchor) => {
    const index = sampledCandles.findIndex((bar) => bar.timestamp === anchor.timestamp);

    if (index < 0 || sampledCandles.length === 0) {
      return null;
    }

    return {
      x: ((index + 0.5) / sampledCandles.length) * 100,
      y: 100 - ((anchor.price - range.min) / spread) * 100
    };
  };

  const anchorFromPointer = (event: PointerEvent): DrawingAnchor | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || sampledCandles.length === 0) {
      return null;
    }

    const xRatio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)));
    const yRatio = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1)));
    const candleIndex = Math.max(
      0,
      Math.min(sampledCandles.length - 1, Math.round(xRatio * sampledCandles.length - 0.5))
    );
    const price = range.max - yRatio * spread;

    return {
      timestamp: sampledCandles[candleIndex].timestamp,
      price: Number(price.toFixed(4))
    };
  };

  useEffect(() => {
    if (!containerRef.current || candles.length === 0 || typeof ResizeObserver === "undefined") {
      return;
    }

    const container = containerRef.current;
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#111722" },
        textColor: "#9aa5b4",
        attributionLogo: false
      },
      grid: {
        vertLines: { color: "rgba(37, 45, 56, 0.72)" },
        horzLines: { color: "rgba(37, 45, 56, 0.72)" }
      },
      rightPriceScale: {
        borderColor: "#252d38",
        textColor: "#9aa5b4"
      },
      timeScale: {
        borderColor: "#252d38",
        timeVisible: true,
        secondsVisible: false
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: interactionMode === "pan",
        horzTouchDrag: interactionMode === "pan",
        vertTouchDrag: false
      },
      handleScale: {
        axisPressedMouseMove: interactionMode === "pan",
        mouseWheel: true,
        pinch: false
      },
      crosshair: {
        mode: CrosshairMode.Normal
      }
    });
    chartRef.current = chart;
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c7aa",
      downColor: "#d4545d",
      borderUpColor: "#2bd8bd",
      borderDownColor: "#ff6f7a",
      wickUpColor: "#b7f7ed",
      wickDownColor: "#ffb4ba"
    });
    candleSeries.setData(
      candles.map((bar) => ({
        time: toChartTime(bar.timestamp),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close
      }))
    );

    const key = chartKey(ticker, timeframe);
    const savedRange = visibleRangeByChartKey.get(key);
    const clampedRange = savedRange ? clampLogicalRange(savedRange, candles.length) : null;
    if (clampedRange) {
      chart.timeScale().setVisibleLogicalRange(clampedRange);
    } else {
      chart.timeScale().fitContent();
    }

    const handleVisibleRangeChange: LogicalRangeChangeEventHandler = (range) => {
      if (!range) {
        return;
      }

      visibleRangeByChartKey.set(key, range);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    const handleClick = (param: MouseEventParams<Time>) => {
      const candle = nearestCandleForTime(candles, param.time);
      if (!candle) {
        return;
      }

      onSelectDrawing(null);
      onSelect(candle);
    };
    chart.subscribeClick(handleClick);

    return () => {
      chart.unsubscribeClick(handleClick);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, interactionMode, onSelect, onSelectDrawing, ticker, timeframe]);

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      const anchor = anchorFromPointer(event);
      if (anchor) {
        setDragPreviewAnchor(anchor);
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      const anchor = dragPreviewAnchor ?? anchorFromPointer(event);
      if (anchor) {
        void window.dispatchEvent(
          new CustomEvent("edgelord:trendline-drag-end", {
            detail: {
              drawingId: dragging.drawingId,
              anchorIndex: dragging.anchorIndex,
              anchor
            }
          })
        );
      }
      setDragging(null);
      setDragPreviewAnchor(null);
    };

    const onPointerCancel = () => {
      setDragging(null);
      setDragPreviewAnchor(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [dragging, dragPreviewAnchor, sampledCandles, range.max, spread]);

  if (candles.length === 0) {
    return <div className="empty-chart">Import SOXL/SOXS data to populate this chart.</div>;
  }

  const resetChartView = () => {
    visibleRangeByChartKey.delete(chartKey(ticker, timeframe));
    chartRef.current?.timeScale().fitContent();
  };

  return (
    <div
      className="lightweight-price-chart"
      data-interaction-mode={interactionMode}
      aria-label="Price candles"
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) {
          return;
        }

        resetChartView();
      }}
    >
      <div className="lightweight-chart-surface" ref={containerRef} />
      <div className="time-axis lightweight-fallback-axis" aria-label={`${ticker} time axis`}>
        {timeTicks(sampledCandles).map((bar, index) => (
          <span key={`${bar.timestamp}-${index}`}>{formatTickTime(bar.timestamp)}</span>
        ))}
      </div>
      <button
        className="chart-fit-button"
        type="button"
        aria-label={`Reset ${ticker} ${timeframe} chart view`}
        title="Fit chart"
        onClick={resetChartView}
      >
        Fit
      </button>
      <div className="price-scale-proxy" aria-label={`${ticker} price scale`} />
      {hoveredIndex >= 0 ? (
        <span className="price-crosshair-layer" aria-hidden="true">
          <span
            className="price-crosshair"
            style={{
              left: `${((hoveredIndex + 0.5) / sampledCandles.length) * 100}%`
            }}
          />
        </span>
      ) : null}
      <svg className="trendline-layer" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
        {visibleTrendlines.map((drawing) => {
          const startAnchor = anchorForDrawing(drawing, 0);
          const endAnchor = anchorForDrawing(drawing, 1);
          const start = startAnchor ? pointForAnchor(startAnchor) : null;
          const end = endAnchor ? pointForAnchor(endAnchor) : null;
          if (!start || !end) {
            return null;
          }

          if (Math.abs(end.x - start.x) < MIN_RENDERED_TRENDLINE_SPAN_PERCENT) {
            return null;
          }

          return (
            <g key={drawing.id}>
              <line
                aria-label={`${drawing.ticker} trendline hit area`}
                className="drawing-hit-line"
                x1={`${start.x}%`}
                y1={`${start.y}%`}
                x2={`${end.x}%`}
                y2={`${end.y}%`}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectDrawing(drawing.id);
                }}
              />
              <line
                aria-label={`${drawing.ticker} trendline`}
                className={selectedDrawingId === drawing.id ? "trendline selected" : "trendline"}
                x1={`${start.x}%`}
                y1={`${start.y}%`}
                x2={`${end.x}%`}
                y2={`${end.y}%`}
                stroke="#f2d35e"
                strokeWidth={selectedDrawingId === drawing.id ? "3" : "2"}
              />
            </g>
          );
        })}
        {visibleMarkers.map((drawing) => {
          const point = pointForAnchor(drawing.anchors[0]);
          if (!point) {
            return null;
          }

          const points = `${point.x},${point.y - 5} ${point.x - 1.8},${point.y + 1.5} ${point.x + 1.8},${point.y + 1.5}`;

          return (
            <polygon
              key={drawing.id}
              aria-label={`${drawing.ticker} breakout marker`}
              className={selectedDrawingId === drawing.id ? "breakout-marker selected" : "breakout-marker"}
              points={points}
              onClick={(event) => {
                event.stopPropagation();
                onSelectDrawing(drawing.id);
              }}
            />
          );
        })}
      </svg>
      {visibleTrendlines.filter((drawing) => drawing.id === selectedDrawingId).map((drawing) =>
        drawing.anchors.slice(0, 2).map((anchor, index) => {
          const previewAnchor = anchorForDrawing(drawing, index as 0 | 1) ?? anchor;
          const point = pointForAnchor(previewAnchor);
          if (!point) {
            return null;
          }

          return (
            <button
              aria-label={`Drag ${drawing.ticker} trendline ${index === 0 ? "start" : "end"}`}
              className="trendline-handle"
              key={`${drawing.id}-${index}`}
              style={{
                left: `${point.x}%`,
                top: `${point.y}%`
              }}
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                onSelectDrawing(drawing.id);
                setDragPreviewAnchor(anchor);
                setDragging({
                  drawingId: drawing.id,
                  anchorIndex: index as 0 | 1
                });
              }}
            />
          );
        })
      )}
      {pendingTrendlineAnchor ? (
        <span
          className="pending-trendline-anchor"
          style={(() => {
            const point = pointForAnchor(pendingTrendlineAnchor);
            return point
              ? {
                  left: `${point.x}%`,
                  top: `${point.y}%`
                }
              : undefined;
          })()}
        />
      ) : null}
      {selectedIndex >= 0 && selectedCandle ? (
        <span
          aria-hidden="true"
          className={[
            "selected-candle-marker",
            selectedCandleRole === "related" ? "related" : "active"
          ].join(" ")}
          style={
            {
              "--selected-candle-x": `${((selectedIndex + 0.5) / sampledCandles.length) * 100}%`,
              "--selected-candle-y": `${100 - ((selectedCandle.close - range.min) / spread) * 100}%`
            } as CSSProperties
          }
        />
      ) : null}
      {selectedIndex >= 0 && selectedCandle ? (
        <span
          aria-label={`${ticker} ${selectedCandleRole === "related" ? "related selected" : "selected"} close ${selectedCandle.close.toFixed(2)}`}
          className={[
            "selected-price-tag",
            selectedCandleRole === "related" ? "related" : "active"
          ].join(" ")}
          style={{
            top: `${100 - ((selectedCandle.close - range.min) / spread) * 100}%`
          }}
        >
          {selectedCandle.close.toFixed(2)}
        </span>
      ) : null}
      {sampledCandles.map((bar, index) => {
        const labelsForCandle = labelsByTimestamp[bar.timestamp] ?? [];
        if (labelsForCandle.length === 0) {
          return null;
        }

        const selectedLabelInCluster = labelsForCandle.find((label) => label.id === selectedLabelId);
        if (labelsForCandle.length > 1 && !selectedLabelInCluster) {
          const x = ((index + 0.5) / sampledCandles.length) * 100;
          const clusterSeverity = labelsForCandle.some((label) => labelIssueSeverity[label.id] === "error")
            ? "error"
            : labelsForCandle.some((label) => labelIssueSeverity[label.id] === "warning")
              ? "warning"
              : null;
          const primaryLabel = labelsForCandle[0];
          const y = 100 - ((primaryLabel.price - range.min) / spread) * 100;

          if (y < -8 || y > 108) {
            return null;
          }

          return (
            <span className="label-anchor" key={`${bar.timestamp}-cluster`}>
              <span
                aria-hidden="true"
                className={["label-anchor-pin", "cluster", clusterSeverity ?? ""]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  left: `${x}%`,
                  top: `${y}%`
                }}
              />
              <button
                aria-label={`Open ${labelsForCandle.length} label cluster ${ticker} at ${bar.timestamp}`}
                className={["label-marker", "cluster", clusterSeverity ?? ""]
                  .filter(Boolean)
                  .join(" ")}
                style={
                  {
                    "--label-marker-offset": "0px",
                    left: `${x}%`,
                    top: `${y}%`
                  } as CSSProperties
                }
                title={`${labelsForCandle.length} labels at ${bar.timestamp}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectDrawing(null);
                  onSelect(bar);
                  onSelectLabel(primaryLabel);
                }}
              >
                <span>{labelsForCandle.length}</span>
                <strong>{labelsForCandle.length} labels</strong>
              </button>
            </span>
          );
        }

        return labelsForCandle.slice(0, 4).map((label, labelIndex) => {
          const x = ((index + 0.5) / sampledCandles.length) * 100;
          const y = 100 - ((label.price - range.min) / spread) * 100;
          const verticalOffset = labelIndex * 24;

          if (y < -8 || y > 108) {
            return null;
          }

          return (
            <span className="label-anchor" key={label.id}>
              <span
                aria-hidden="true"
                className={[
                  "label-anchor-pin",
                  label.labelType.toLowerCase(),
                  labelIssueSeverity[label.id] ?? "",
                  selectedLabelId === label.id ? "selected" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  left: `${x}%`,
                  top: `${y}%`
                }}
              />
              <button
                aria-label={`Edit ${label.labelType} label ${label.ticker} ${label.price.toFixed(2)} at ${bar.timestamp}`}
                className={[
                  "label-marker",
                  label.labelType.toLowerCase(),
                  labelIssueSeverity[label.id] ?? "",
                  selectedLabelId === label.id ? "selected" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={
                  {
                    "--label-marker-offset": `${verticalOffset}px`,
                    left: `${x}%`,
                    top: `${y}%`
                  } as CSSProperties
                }
                title={`${label.labelType} ${label.ticker} ${label.price.toFixed(2)} at ${bar.timestamp}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectDrawing(null);
                  onSelect(bar);
                  onSelectLabel(label);
                }}
              >
                <span>{label.labelType[0]}</span>
                <strong>{label.price.toFixed(2)}</strong>
              </button>
            </span>
          );
        });
      })}
      <div className="chart-hit-targets">
        {sampledCandles.map((bar, index) => (
          <button
            key={bar.timestamp}
            className={selectedTimestamp === bar.timestamp ? "chart-hit-target selected" : "chart-hit-target"}
            style={{
              left: `${(index / Math.max(sampledCandles.length - 1, 1)) * 100}%`
            }}
            type="button"
            title={`${bar.timestamp} close ${bar.close.toFixed(2)}`}
            onClick={() => {
              onSelectDrawing(null);
              onSelect(bar);
            }}
          />
        ))}
      </div>
    </div>
  );
}
