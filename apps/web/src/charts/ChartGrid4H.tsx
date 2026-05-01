import { useMemo, useState } from "react";

import { ReplayChart } from "./ReplayChart";
import {
  chartGridTimeframes,
  useAppStore,
  visibleCandlesForReplayBoundary
} from "../store/useAppStore";
import type { LabelIssueSeverity } from "./LightweightPriceChart";

const tickers = ["SOXL", "SOXS"] as const;

export function ChartGrid4H() {
  const mode = useAppStore((state) => state.mode);
  const replayIndex = useAppStore((state) => state.replayIndex);
  const chartLayoutMode = useAppStore((state) => state.chartLayoutMode);
  const chartInteractionMode = useAppStore((state) => state.chartInteractionMode);
  const activeTimeframe = useAppStore((state) => state.activeTimeframe);
  const focusedTicker = useAppStore((state) => state.focusedTicker);
  const syncData = useAppStore((state) => state.syncData);
  const syncDataByTimeframe = useAppStore((state) => state.syncDataByTimeframe);
  const selectedCandle = useAppStore((state) => state.selectedCandle);
  const selectedLabelId = useAppStore((state) => state.selectedLabelId);
  const sessionLabels = useAppStore((state) => state.sessionLabels);
  const exportValidationReport = useAppStore((state) => state.exportValidationReport);
  const drawings = useAppStore((state) => state.drawings);
  const drawingMode = useAppStore((state) => state.drawingMode);
  const selectedDrawingId = useAppStore((state) => state.selectedDrawingId);
  const selectDrawing = useAppStore((state) => state.selectDrawing);
  const focusLabel = useAppStore((state) => state.focusLabel);
  const handleChartCandleClick = useAppStore((state) => state.handleChartCandleClick);
  const setChartLayoutMode = useAppStore((state) => state.setChartLayoutMode);
  const focusChartPanel = useAppStore((state) => state.focusChartPanel);
  const moveTrendlineAnchor = useAppStore((state) => state.moveTrendlineAnchor);
  const [hoveredTimestamp, setHoveredTimestamp] = useState<string | null>(null);

  const replayBoundaryTimestamp = syncData?.timestamps[replayIndex] ?? null;
  const labelIssueSeverity = useMemo(
    () =>
      (exportValidationReport?.issues ?? []).reduce<Record<string, LabelIssueSeverity>>(
        (severityByLabelId, issue) => {
          if (!issue.labelId || (issue.severity !== "warning" && issue.severity !== "error")) {
            return severityByLabelId;
          }

          if (issue.severity === "error" || severityByLabelId[issue.labelId] !== "error") {
            severityByLabelId[issue.labelId] = issue.severity;
          }

          return severityByLabelId;
        },
        {}
      ),
    [exportValidationReport?.issues]
  );

  return (
    <section
      className={`chart-stack ${mode}-mode ${chartLayoutMode === "focused" ? "focused-layout" : "grid-layout"}`}
      aria-label="Synchronized multi-timeframe chart grid"
    >
      {tickers.map((ticker) => {
        return chartGridTimeframes.map((timeframe) => {
          const data =
            syncDataByTimeframe[timeframe] ??
            (syncData?.timeframe === timeframe ? syncData : null);
          const series = data?.series[ticker] ?? null;
          const visibleCandles = visibleCandlesForReplayBoundary(
            series?.candles ?? [],
            mode,
            replayBoundaryTimestamp
          );
          const hasSelectedTimestamp = selectedCandle
            ? visibleCandles.some((candle) => candle.timestamp === selectedCandle.timestamp)
            : false;
          const isActiveSelection =
            Boolean(selectedCandle) &&
            selectedCandle?.ticker === ticker &&
            (selectedCandle.timeframe ?? activeTimeframe) === timeframe;
          const selectedTimestamp = selectedCandle
            ? hasSelectedTimestamp
              ? selectedCandle.timestamp
              : null
            : mode === "replay"
              ? replayBoundaryTimestamp
              : null;

          return (
            <ReplayChart
              key={`${ticker}-${timeframe}`}
              ticker={ticker}
              timeframe={timeframe}
              series={series}
              visibleCandles={visibleCandles}
              selectedTimestamp={selectedTimestamp}
              selectedCandleRole={
                selectedCandle && selectedTimestamp
                  ? isActiveSelection
                    ? "active"
                    : "related"
                  : null
              }
              interactionMode={chartInteractionMode}
              hoveredTimestamp={hoveredTimestamp}
              drawings={drawings.filter(
                (drawing) => drawing.ticker === ticker && drawing.timeframe === timeframe
              )}
              labels={sessionLabels.filter(
                (label) => label.ticker === ticker && label.timeframe === timeframe
              )}
              labelIssueSeverity={labelIssueSeverity}
              selectedLabelId={selectedLabelId}
              selectedDrawingId={selectedDrawingId}
              pendingTrendlineAnchor={
                drawingMode?.ticker === ticker &&
                drawingMode.timeframe === timeframe &&
                drawingMode.type === "trendline"
                  ? drawingMode.firstAnchor
                  : null
              }
              isFocused={focusedTicker === ticker && activeTimeframe === timeframe}
              isLayoutFocused={chartLayoutMode === "focused"}
              compactIndicators={chartLayoutMode !== "focused"}
              onToggleLayout={(selectedTicker, selectedTimeframe) => {
                const isFocusedPanel =
                  focusedTicker === selectedTicker && activeTimeframe === selectedTimeframe;
                if (chartLayoutMode === "focused" && isFocusedPanel) {
                  setChartLayoutMode("grid");
                  return;
                }

                void focusChartPanel(selectedTicker, selectedTimeframe);
                setChartLayoutMode("focused");
              }}
              onSelectDrawing={selectDrawing}
              onSelectLabel={(label) => void focusLabel(label)}
              onHoverTimestamp={setHoveredTimestamp}
              onSelectCandle={(selectedTicker, candle) =>
                void handleChartCandleClick(selectedTicker, candle)
              }
              onMoveTrendlineAnchor={moveTrendlineAnchor}
            />
          );
        });
      })}
    </section>
  );
}
