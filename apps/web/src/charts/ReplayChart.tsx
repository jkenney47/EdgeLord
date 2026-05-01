import { useEffect } from "react";
import type { PointerEvent } from "react";

import type {
  ChartCandle,
  ChartTimeframe,
  Drawing,
  DrawingAnchor,
  IndicatorSnapshot,
  TickerChartSeries,
  TradeEvent
} from "../api/client";
import { indicatorPanes, overlaySummary } from "./indicatorPanes";
import type { IndicatorPane } from "./indicatorPanes";
import { candleIndexFromPointerRatio } from "./chartMath";
import { LightweightPriceChart } from "./LightweightPriceChart";
import type { ChartInteractionMode } from "../store/useAppStore";
import type { LabelIssueSeverity } from "./LightweightPriceChart";

type ReplayChartProps = {
  ticker: "SOXL" | "SOXS";
  timeframe: ChartTimeframe;
  series: TickerChartSeries | null;
  visibleCandles: ChartCandle[];
  selectedTimestamp: string | null;
  selectedCandleRole: "active" | "related" | null;
  interactionMode: ChartInteractionMode;
  hoveredTimestamp: string | null;
  drawings: Drawing[];
  labels: TradeEvent[];
  labelIssueSeverity: Record<string, LabelIssueSeverity>;
  selectedLabelId: string | null;
  selectedDrawingId: string | null;
  pendingTrendlineAnchor: DrawingAnchor | null;
  isFocused: boolean;
  isLayoutFocused: boolean;
  compactIndicators: boolean;
  onToggleLayout: (ticker: "SOXL" | "SOXS", timeframe: ChartTimeframe) => void;
  onSelectDrawing: (drawingId: string | null) => void;
  onSelectLabel: (label: TradeEvent) => void;
  onHoverTimestamp: (timestamp: string | null) => void;
  onSelectCandle: (ticker: string, candle: ChartCandle) => void;
  onMoveTrendlineAnchor: (
    drawingId: string,
    anchorIndex: 0 | 1,
    anchor: DrawingAnchor
  ) => Promise<void>;
};

function latestIndicator(
  series: TickerChartSeries | null,
  visibleCandles: ChartCandle[]
): IndicatorSnapshot | null {
  if (!series || visibleCandles.length === 0) {
    return null;
  }

  const lastTimestamp = visibleCandles[visibleCandles.length - 1].timestamp;
  return series.indicators.find((indicator) => indicator.timestamp === lastTimestamp) ?? null;
}

function visibleIndicators(
  series: TickerChartSeries | null,
  visibleCandles: ChartCandle[]
): IndicatorSnapshot[] {
  if (!series || visibleCandles.length === 0) {
    return [];
  }

  const visibleTimestampSet = new Set(visibleCandles.map((candle) => candle.timestamp));
  return series.indicators.filter((indicator) => visibleTimestampSet.has(indicator.timestamp));
}

function formatSelectedReadout(candle: ChartCandle | null): string {
  if (!candle) {
    return "No candle selected";
  }

  return `${candle.timestamp.slice(0, 10)} O ${candle.open.toFixed(2)} H ${candle.high.toFixed(
  2
  )} L ${candle.low.toFixed(2)} C ${candle.close.toFixed(2)} Vol ${formatVolume(
    candle.volume
  )} ${formatChange(candle)}`;
}

function formatVolume(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toFixed(0);
}

function formatChange(candle: ChartCandle): string {
  if (candle.open === 0) {
    return "+0.00%";
  }

  const change = ((candle.close - candle.open) / candle.open) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
}

function valuePartsForPane(
  pane: IndicatorPane,
  hoveredIndex: number | null
): IndicatorPane["valueParts"] {
  if (hoveredIndex === null) {
    return pane.valueParts ?? [{ text: pane.value }];
  }

  const primary = pane.values.slice(-120)[hoveredIndex] ?? null;
  const secondary = pane.secondaryValues?.slice(-120)[hoveredIndex] ?? null;
  const digits = pane.className === "smio-pane" ? 4 : 2;

  if (pane.className === "stoch-rsi-pane") {
    return [
      { text: primary === null ? "warming" : primary.toFixed(digits), tone: "green" },
      { text: secondary === null ? "warming" : secondary.toFixed(digits), tone: "red" }
    ];
  }

  if (pane.className === "cm-wvf-pane") {
    return [
      { text: primary === null ? "warming" : primary.toFixed(digits), tone: "gray" },
      { text: "0.0000", tone: "green" }
    ];
  }

  return [{ text: primary === null ? "warming" : primary.toFixed(digits) }];
}

function compactIndicatorLabel(label: string): string {
  if (label.startsWith("SMIO")) {
    return "SMIO";
  }
  if (label.startsWith("Stoch RSI")) {
    return "Stoch";
  }
  if (label.startsWith("CM_WVF")) {
    return "WVF";
  }
  if (label.startsWith("ATR")) {
    return "ATR";
  }

  return label;
}

function IndicatorPaneChart({
  pane,
  hoveredIndex
}: {
  pane: IndicatorPane;
  hoveredIndex: number | null;
}) {
  const width = 720;
  const height = 72;
  const primaryValues = pane.values.slice(-120);
  const histogramToneValues = pane.histogramToneValues?.slice(-120) ?? [];
  const secondaryValues = pane.secondaryValues?.slice(-120) ?? [];
  const allValues = [...primaryValues, ...secondaryValues].filter(
    (value): value is number => value !== null
  );

  if (allValues.length < 2) {
    return <span className="indicator-pane-empty">needs more candles</span>;
  }

  const computedMin = Math.min(...allValues);
  const computedMax = Math.max(...allValues);
  const min =
    pane.scaleMode === "bounded" && pane.bounds
      ? pane.bounds.min
      : pane.scaleMode === "zero"
        ? Math.min(computedMin, 0)
        : computedMin;
  const max =
    pane.scaleMode === "bounded" && pane.bounds
      ? pane.bounds.max
      : pane.scaleMode === "zero"
        ? Math.max(computedMax, 0)
        : computedMax;
  const spread = Math.max(max - min, 1);
  const xForIndex = (index: number, count: number) =>
    count <= 1 ? width / 2 : (index / (count - 1)) * width;
  const yForValue = (value: number) =>
    height - ((Math.max(min, Math.min(max, value)) - min) / spread) * height;

  const linePoints = (values: Array<number | null>) =>
    values
      .map((value, index) =>
        value === null ? null : `${xForIndex(index, values.length).toFixed(2)},${yForValue(value).toFixed(2)}`
      )
      .filter((value): value is string => value !== null)
      .join(" ");

  const tickValues = Array.from(
    new Set([
      max,
      min,
      ...(pane.referenceLines ?? [])
        .map((line) => line.value)
        .filter((value) => value >= min && value <= max)
    ])
  ).sort((left, right) => right - left);

  const referenceLines = pane.referenceLines ?? [];
  const referenceBands = pane.referenceBands ?? [];
  const scaleFormatter = Math.abs(max - min) <= 1 ? 4 : 2;
  const latestPrimaryValue = [...primaryValues].reverse().find((value) => value !== null) ?? null;
  const latestSecondaryValue = [...secondaryValues].reverse().find((value) => value !== null) ?? null;
  const hoverX =
    hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < primaryValues.length
      ? ((hoveredIndex + 0.5) / primaryValues.length) * width
      : null;

  const valueTagTop = (value: number) =>
    `${Math.max(8, Math.min(92, ((Math.max(min, Math.min(max, value)) - min) / spread) * -100 + 100))}%`;
  const rawLatestValueTags = [
    latestPrimaryValue === null
      ? null
      : {
          className:
            pane.className === "stoch-rsi-pane"
              ? "green"
              : pane.className === "cm-wvf-pane"
                ? "gray"
                : "default",
          text: latestPrimaryValue.toFixed(scaleFormatter),
          top: valueTagTop(latestPrimaryValue)
        },
    latestSecondaryValue === null
      ? null
      : {
          className: "red",
          text: latestSecondaryValue.toFixed(scaleFormatter),
          top: valueTagTop(latestSecondaryValue)
        },
    pane.className === "cm-wvf-pane"
      ? {
          className: "green",
          text: "0.0000",
          top: valueTagTop(0)
        }
      : null
  ].filter((tag): tag is { className: string; text: string; top: string } => tag !== null);
  const latestValueTags = rawLatestValueTags.map((tag, index, tags) => {
    const topNumber = Number.parseFloat(tag.top);
    const earlierCollisionCount = tags
      .slice(0, index)
      .filter((other) => Math.abs(Number.parseFloat(other.top) - topNumber) < 9).length;

    if (earlierCollisionCount === 0) {
      return tag;
    }

    return {
      ...tag,
      top: `${Math.max(8, Math.min(92, topNumber + earlierCollisionCount * 9))}%`
    };
  });

  if (pane.kind === "histogram") {
    const zeroY = yForValue(Math.max(Math.min(0, max), min));
    const barWidth = Math.max(width / primaryValues.length - 1.5, 1.5);

    return (
      <div className="indicator-pane-chart">
        <svg
          className="indicator-chart"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {referenceBands.map((band) => (
            <rect
              className="indicator-reference-band"
              key={`${band.from}-${band.to}`}
              x="0"
              y={Math.min(yForValue(band.from), yForValue(band.to))}
              width={width}
              height={Math.abs(yForValue(band.from) - yForValue(band.to))}
            />
          ))}
          {referenceLines.map((line) => (
            <line
              className="indicator-reference"
              key={line.value}
              x1="0"
              y1={yForValue(line.value)}
              x2={width}
              y2={yForValue(line.value)}
            />
          ))}
          {hoverX === null ? null : (
            <line className="indicator-crosshair" x1={hoverX} y1="0" x2={hoverX} y2={height} />
          )}
          <line className="indicator-zero" x1="0" y1={zeroY} x2={width} y2={zeroY} />
          {primaryValues.map((value, index) => {
            if (value === null) {
              return null;
            }

            const y = yForValue(value);
            const x = xForIndex(index, primaryValues.length);
            const tone = histogramToneValues[index] ?? (value >= 0 ? "positive" : "negative");
            return (
              <rect
                className={`mini-bar ${tone}`}
                height={Math.max(Math.abs(zeroY - y), 1)}
                key={`${index}-${value}`}
                width={barWidth}
                x={x}
                y={Math.min(y, zeroY)}
              />
            );
          })}
        </svg>
        <div className="indicator-scale" aria-hidden="true">
          {tickValues.map((value) => (
            <span key={value}>{value.toFixed(scaleFormatter)}</span>
          ))}
        </div>
        {latestValueTags.map((tag) => (
          <span
            aria-hidden="true"
            className={`indicator-value-tag ${tag.className}`}
            key={`${tag.className}-${tag.text}`}
            style={{ top: tag.top }}
          >
            {tag.text}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="indicator-pane-chart">
      <svg
        className="indicator-chart"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {referenceBands.map((band) => (
          <rect
            className="indicator-reference-band"
            key={`${band.from}-${band.to}`}
            x="0"
            y={Math.min(yForValue(band.from), yForValue(band.to))}
            width={width}
            height={Math.abs(yForValue(band.from) - yForValue(band.to))}
          />
        ))}
        {referenceLines.map((line) => (
          <line
            className="indicator-reference"
            key={line.value}
            x1="0"
            y1={yForValue(line.value)}
            x2={width}
            y2={yForValue(line.value)}
          />
        ))}
        {hoverX === null ? null : (
          <line className="indicator-crosshair" x1={hoverX} y1="0" x2={hoverX} y2={height} />
        )}
        <polyline className="indicator-line primary" points={linePoints(primaryValues)} />
        {pane.kind === "dual-line" ? (
          <polyline className="indicator-line secondary" points={linePoints(secondaryValues)} />
        ) : null}
      </svg>
      <div className="indicator-scale" aria-hidden="true">
        {tickValues.map((value) => (
          <span key={value}>{value.toFixed(scaleFormatter)}</span>
        ))}
      </div>
      {latestValueTags.map((tag) => (
        <span
          aria-hidden="true"
          className={`indicator-value-tag ${tag.className}`}
          key={`${tag.className}-${tag.text}`}
          style={{ top: tag.top }}
        >
          {tag.text}
        </span>
      ))}
    </div>
  );
}

export function ReplayChart({
  ticker,
  timeframe,
  series,
  visibleCandles,
  selectedTimestamp,
  selectedCandleRole,
  interactionMode,
  hoveredTimestamp,
  drawings,
  labels,
  labelIssueSeverity,
  selectedLabelId,
  selectedDrawingId,
  pendingTrendlineAnchor,
  isFocused,
  isLayoutFocused,
  compactIndicators,
  onToggleLayout,
  onSelectDrawing,
  onSelectLabel,
  onHoverTimestamp,
  onMoveTrendlineAnchor,
  onSelectCandle
}: ReplayChartProps) {
  const latestCandle = visibleCandles.at(-1) ?? null;
  const selectedCandle =
    visibleCandles.find((candle) => candle.timestamp === selectedTimestamp) ?? null;
  const latest = latestIndicator(series, visibleCandles);
  const panes = indicatorPanes(visibleIndicators(series, visibleCandles));
  const visibleBars = visibleCandles.slice(-120);
  const hoveredIndex =
    hoveredTimestamp === null
      ? null
      : visibleBars.findIndex((candle) => candle.timestamp === hoveredTimestamp);
  const safeHoveredIndex = hoveredIndex !== null && hoveredIndex >= 0 ? hoveredIndex : null;
  const hoveredCandle = safeHoveredIndex === null ? null : visibleBars[safeHoveredIndex] ?? null;

  const updateHoverIndex = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (visibleBars.length === 0 || rect.width <= 0) {
      onHoverTimestamp(null);
      return;
    }

    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const nextIndex = candleIndexFromPointerRatio(ratio, visibleBars.length);
    onHoverTimestamp(nextIndex === null ? null : visibleBars[nextIndex].timestamp);
  };

  useEffect(() => {
    const onDragEnd = (event: Event) => {
      const customEvent = event as CustomEvent<{
        drawingId: string;
        anchorIndex: 0 | 1;
        anchor: DrawingAnchor;
      }>;

      void onMoveTrendlineAnchor(
        customEvent.detail.drawingId,
        customEvent.detail.anchorIndex,
        customEvent.detail.anchor
      );
    };

    window.addEventListener("edgelord:trendline-drag-end", onDragEnd);
    return () => {
      window.removeEventListener("edgelord:trendline-drag-end", onDragEnd);
    };
  }, [onMoveTrendlineAnchor]);

  return (
    <section
      className={[
        "chart-panel",
        isFocused ? "focused" : "",
        isLayoutFocused && isFocused ? "expanded" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`${ticker} ${timeframe} chart`}
    >
      <header className="chart-header">
        <div>
          <span className="status-dot" />
          <strong>{ticker}</strong>
          <span>{timeframe}</span>
        </div>
        <span className="chart-state">
          {latestCandle ? `${visibleCandles.length} bars / ${latestCandle.close.toFixed(2)}` : "No data"}
        </span>
        <div className="chart-readouts" aria-label={`${ticker} ${timeframe} chart readouts`}>
          {hoveredCandle ? (
            <span className="chart-readout hover">
              <span>Hover</span>
              <strong>{formatSelectedReadout(hoveredCandle)}</strong>
            </span>
          ) : null}
          {selectedCandle || !hoveredCandle ? (
            <span className="chart-readout selected">
              <span>Selected</span>
              <strong>{formatSelectedReadout(selectedCandle)}</strong>
            </span>
          ) : null}
        </div>
        <button
          aria-label={
            isLayoutFocused && isFocused
              ? "Show all chart panels"
              : `Focus ${ticker} ${timeframe} chart panel`
          }
          className="chart-focus-button"
          title={isLayoutFocused && isFocused ? "Show grid" : "Focus chart"}
          type="button"
          onClick={() => onToggleLayout(ticker, timeframe)}
        >
          <span className="chart-focus-icon" aria-hidden="true" />
          <span className="sr-only">{isLayoutFocused && isFocused ? "Grid" : "Focus"}</span>
        </button>
      </header>
      <div
        className={compactIndicators ? "chart-body compact-indicators" : "chart-body"}
        onPointerLeave={() => onHoverTimestamp(null)}
        onPointerMove={updateHoverIndex}
      >
        <div className="price-pane">
          <div className="overlay-summary">{overlaySummary(latest)}</div>
          <LightweightPriceChart
            candles={visibleCandles}
            drawings={drawings}
            labels={labels}
            labelIssueSeverity={labelIssueSeverity}
            selectedLabelId={selectedLabelId}
            selectedDrawingId={selectedDrawingId}
            ticker={ticker}
            timeframe={timeframe}
            selectedTimestamp={selectedTimestamp}
            hoveredTimestamp={hoveredTimestamp}
            selectedCandleRole={selectedCandleRole}
            interactionMode={interactionMode}
            pendingTrendlineAnchor={pendingTrendlineAnchor}
            onSelectDrawing={onSelectDrawing}
            onSelectLabel={onSelectLabel}
            onSelect={(candle) => onSelectCandle(ticker, candle)}
          />
        </div>
        {compactIndicators ? (
          <div className="indicator-compact-grid" aria-label={`${ticker} ${timeframe} compact indicator states`}>
            {panes.map((pane) => (
              <div className="indicator-compact-badge" key={pane.label}>
                <span>{compactIndicatorLabel(pane.label)}</span>
                <strong>
                  {(valuePartsForPane(pane, safeHoveredIndex) ?? [{ text: pane.value }]).map((part, index) => (
                    <span
                      className={part.tone ? `indicator-value-part ${part.tone}` : "indicator-value-part"}
                      key={`${part.text}-${index}`}
                    >
                      {part.text}
                    </span>
                  ))}
                </strong>
              </div>
            ))}
          </div>
        ) : panes.map((pane) => (
          <div className={pane.className ? `indicator-strip ${pane.className}` : "indicator-strip"} key={pane.label}>
            <div className="indicator-pane-head">
              <span className="indicator-label">{pane.label}</span>
              <strong>
                {(valuePartsForPane(pane, safeHoveredIndex) ?? [{ text: pane.value }]).map((part, index) => (
                  <span
                    className={part.tone ? `indicator-value-part ${part.tone}` : "indicator-value-part"}
                    key={`${part.text}-${index}`}
                  >
                    {part.text}
                  </span>
                ))}
              </strong>
            </div>
            <IndicatorPaneChart pane={pane} hoveredIndex={safeHoveredIndex} />
          </div>
        ))}
      </div>
    </section>
  );
}
