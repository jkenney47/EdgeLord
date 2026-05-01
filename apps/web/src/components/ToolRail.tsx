import { chartGridTimeframes, useAppStore } from "../store/useAppStore";

const tickers = ["SOXL", "SOXS"] as const;

export function ToolRail() {
  const focusedTicker = useAppStore((state) => state.focusedTicker);
  const activeTimeframe = useAppStore((state) => state.activeTimeframe);
  const chartLayoutMode = useAppStore((state) => state.chartLayoutMode);
  const chartInteractionMode = useAppStore((state) => state.chartInteractionMode);
  const drawingMode = useAppStore((state) => state.drawingMode);
  const selectedDrawingId = useAppStore((state) => state.selectedDrawingId);
  const drawingStatus = useAppStore((state) => state.drawingStatus);
  const drawings = useAppStore((state) => state.drawings);
  const setFocusedTicker = useAppStore((state) => state.setFocusedTicker);
  const setActiveTimeframe = useAppStore((state) => state.setActiveTimeframe);
  const setChartLayoutMode = useAppStore((state) => state.setChartLayoutMode);
  const setChartInteractionMode = useAppStore((state) => state.setChartInteractionMode);
  const cancelDrawingMode = useAppStore((state) => state.cancelDrawingMode);
  const startTrendline = useAppStore((state) => state.startTrendline);
  const startBreakoutMarker = useAppStore((state) => state.startBreakoutMarker);
  const deleteSelectedDrawing = useAppStore((state) => state.deleteSelectedDrawing);

  const activeTool =
    drawingMode?.ticker === focusedTicker && drawingMode.timeframe === activeTimeframe
      ? drawingMode.type
      : null;
  const selectedDrawing = drawings.find((drawing) => drawing.id === selectedDrawingId);
  const selectedDrawingLabel = selectedDrawing
    ? `${selectedDrawing.ticker} ${selectedDrawing.timeframe} ${selectedDrawing.type.replace("_", " ")}`
    : null;
  const railStatus =
    drawingStatus ??
    (selectedDrawingLabel ? `Selected ${selectedDrawingLabel}` : "Cursor ready");

  return (
    <aside className="tool-rail" aria-label="Drawing tools">
      <div className="tool-target" aria-label="Chart focus and drawing target ticker">
        {tickers.map((ticker) => (
          <button
            aria-label={`Target ${ticker}`}
            className={focusedTicker === ticker ? "tool-target-toggle active" : "tool-target-toggle"}
            key={ticker}
            type="button"
            onClick={() => setFocusedTicker(ticker)}
          >
            {ticker}
          </button>
        ))}
        <div className="tool-target-timeframes" aria-label="Chart focus and drawing target timeframe">
          {chartGridTimeframes.map((timeframe) => (
            <button
              aria-label={`Target timeframe ${timeframe}`}
              className={
                activeTimeframe === timeframe ? "tool-timeframe-toggle active" : "tool-timeframe-toggle"
              }
              key={timeframe}
              type="button"
              onClick={() => void setActiveTimeframe(timeframe)}
            >
              {timeframe}
            </button>
          ))}
        </div>
      </div>

      <button
        aria-label={
          chartLayoutMode === "focused"
            ? "Show all chart panels"
            : `Focus ${focusedTicker} ${activeTimeframe} chart panel`
        }
        className={chartLayoutMode === "focused" ? "tool-button active" : "tool-button"}
        title={chartLayoutMode === "focused" ? "Show grid" : "Focus chart"}
        type="button"
        onClick={() => setChartLayoutMode(chartLayoutMode === "focused" ? "grid" : "focused")}
      >
        {chartLayoutMode === "focused" ? "Grid" : "Focus"}
      </button>

      <div className="tool-group">
        <button
          aria-label="Select cursor tool"
          className={
            !drawingMode && chartInteractionMode === "cursor" ? "tool-button active" : "tool-button"
          }
          title="Cursor"
          type="button"
          onClick={cancelDrawingMode}
        >
          Cursor
        </button>
        <button
          aria-label="Select pan tool"
          className={
            !drawingMode && chartInteractionMode === "pan" ? "tool-button active" : "tool-button"
          }
          title="Pan chart"
          type="button"
          onClick={() => setChartInteractionMode("pan")}
        >
          Pan
        </button>
        <button
          aria-label={`Draw ${focusedTicker} ${activeTimeframe} trendline`}
          className={activeTool === "trendline" ? "tool-button active" : "tool-button"}
          title="Trendline"
          type="button"
          onClick={() => startTrendline(focusedTicker)}
        >
          Line
        </button>
        <button
          aria-label={`Mark ${focusedTicker} ${activeTimeframe} breakout candle`}
          className={activeTool === "breakout_marker" ? "tool-button active" : "tool-button"}
          title="Breakout marker"
          type="button"
          onClick={() => startBreakoutMarker(focusedTicker)}
        >
          Mark
        </button>
      </div>

      <button
        aria-label={
          selectedDrawingLabel
            ? `Delete selected drawing ${selectedDrawingLabel}`
            : "Delete selected drawing"
        }
        className="tool-button danger-button"
        disabled={!selectedDrawingId}
        title={selectedDrawingLabel ? `Delete ${selectedDrawingLabel}` : "Select a drawing to delete"}
        type="button"
        onClick={() => void deleteSelectedDrawing()}
      >
        Delete
      </button>
      <div className={selectedDrawingId || drawingMode ? "tool-feedback active" : "tool-feedback"} role="status">
        <span>{drawingMode ? "Drawing" : selectedDrawingId ? "Selected" : "Tool"}</span>
        <strong>{railStatus}</strong>
      </div>
    </aside>
  );
}
