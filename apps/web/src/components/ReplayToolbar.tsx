import { useEffect } from "react";

import { tradeEventsExportUrl } from "../api/client";
import { useAppStore } from "../store/useAppStore";

export function ReplayToolbar() {
  const mode = useAppStore((state) => state.mode);
  const activeTimeframe = useAppStore((state) => state.activeTimeframe);
  const focusedTicker = useAppStore((state) => state.focusedTicker);
  const chartLayoutMode = useAppStore((state) => state.chartLayoutMode);
  const replayIndex = useAppStore((state) => state.replayIndex);
  const replaySpeedMs = useAppStore((state) => state.replaySpeedMs);
  const isReplayPlaying = useAppStore((state) => state.isReplayPlaying);
  const replayStartDate = useAppStore((state) => state.replayStartDate);
  const replayDateInput = useAppStore((state) => state.replayDateInput);
  const replayDateError = useAppStore((state) => state.replayDateError);
  const syncData = useAppStore((state) => state.syncData);
  const syncDataByTimeframe = useAppStore((state) => state.syncDataByTimeframe);
  const activeSession = useAppStore((state) => state.activeSession);
  const sessionLabels = useAppStore((state) => state.sessionLabels);
  const reviewSummary = useAppStore((state) => state.reviewSummary);
  const exportValidationReport = useAppStore((state) => state.exportValidationReport);
  const isLoading = useAppStore((state) => state.isLoadingChartData);
  const isImporting = useAppStore((state) => state.isImporting);
  const importError = useAppStore((state) => state.importError);
  const importStartDate = useAppStore((state) => state.importStartDate);
  const importEndDate = useAppStore((state) => state.importEndDate);
  const importBaseTimeframe = useAppStore((state) => state.importBaseTimeframe);
  const lastImportResult = useAppStore((state) => state.lastImportResult);
  const dataCoverage = useAppStore((state) => state.dataCoverage);
  const setMode = useAppStore((state) => state.setMode);
  const stepForward = useAppStore((state) => state.stepForward);
  const moveSelectedCandle = useAppStore((state) => state.moveSelectedCandle);
  const focusAdjacentLabel = useAppStore((state) => state.focusAdjacentLabel);
  const focusNextValidationIssue = useAppStore((state) => state.focusNextValidationIssue);
  const setReplayPlaying = useAppStore((state) => state.setReplayPlaying);
  const setReplayStartDate = useAppStore((state) => state.setReplayStartDate);
  const setReplaySpeedMs = useAppStore((state) => state.setReplaySpeedMs);
  const setImportStartDate = useAppStore((state) => state.setImportStartDate);
  const setImportEndDate = useAppStore((state) => state.setImportEndDate);
  const setImportBaseTimeframe = useAppStore((state) => state.setImportBaseTimeframe);
  const loadChartData = useAppStore((state) => state.loadChartData);
  const runImport = useAppStore((state) => state.runImport);
  const maxIndex = Math.max((syncData?.timestamps.length ?? 1) - 1, 0);
  const visibleCount =
    mode === "replay" ? Math.min(replayIndex + 1, syncData?.timestamps.length ?? 0) : syncData?.timestamps.length ?? 0;
  const totalCount = syncData?.timestamps.length ?? 0;
  const currentTimestamp = syncData?.timestamps[mode === "replay" ? replayIndex : Math.max(totalCount - 1, 0)] ?? null;
  const labelCount = activeSession ? sessionLabels.length : reviewSummary?.totalLabels ?? 0;
  const hasLabels = labelCount > 0;
  const exportBlockers = exportValidationReport?.summary.errorCount ?? 0;
  const exportWarnings = exportValidationReport?.summary.warningCount ?? 0;
  const exportBlocked = exportBlockers > 0;
  const exportScope = activeSession ? "Session" : "All";
  const exportScopeLabel = `${exportScope} ${labelCount} ${labelCount === 1 ? "label" : "labels"}`;
  const exportHref = (format: "csv" | "json") =>
    hasLabels && !exportBlocked ? tradeEventsExportUrl(format, activeSession?.id) : undefined;
  const exportPreviewStatus = !hasLabels
    ? "No rows"
    : exportBlocked
      ? `Blocked ${exportBlockers}`
      : exportWarnings > 0
        ? `Warnings ${exportWarnings}`
        : "Ready";
  const dataWarningCount = Object.values(syncDataByTimeframe).reduce(
    (count, data) =>
      count + (data?.warnings.filter((warning) => warning.severity === "warning").length ?? 0),
    0
  );
  const dataReviewCount = Object.values(syncDataByTimeframe).reduce(
    (count, data) =>
      count + (data?.warnings.filter((warning) => warning.severity === "review").length ?? 0),
    0
  );
  const replayStateLabel =
    mode === "replay"
      ? `Replay hidden after ${(currentTimestamp?.slice(0, 10) ?? replayStartDate) || "--"}`
      : "Regular mode: all bars";
  const coverageTimestamps =
    dataCoverage?.summaries.flatMap((summary) =>
      [summary.firstTimestamp, summary.lastTimestamp].filter((timestamp): timestamp is string =>
        Boolean(timestamp)
      )
    ) ?? [];
  const coverageStart = coverageTimestamps.length > 0 ? [...coverageTimestamps].sort()[0].slice(0, 10) : null;
  const coverageEnd =
    coverageTimestamps.length > 0 ? [...coverageTimestamps].sort().at(-1)?.slice(0, 10) ?? null : null;
  const coverageLabel =
    isLoading
      ? "Loading coverage"
      : coverageStart && coverageEnd
      ? `${coverageStart} to ${coverageEnd}`
      : "No coverage loaded";
  const coverageGapCount = dataCoverage?.gaps.length ?? 0;
  const importStatusLabel = isImporting
    ? "Importing data"
    : importError
      ? `Import failed: ${importError}`
      : lastImportResult
        ? `Imported ${lastImportResult.baseBarsInserted} source / ${lastImportResult.aggregatedBarsInserted} chart bars${
            lastImportResult.warnings.length > 0 ? `, ${lastImportResult.warnings.length} warnings` : ""
          }`
        : null;

  useEffect(() => {
    if (!isReplayPlaying || mode !== "replay") {
      return;
    }

    const timer = window.setInterval(stepForward, replaySpeedMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [isReplayPlaying, mode, replaySpeedMs, stepForward]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      if (event.key === "[" || event.key === "]") {
        event.preventDefault();
        void (event.shiftKey ? focusNextValidationIssue : focusAdjacentLabel)(
          event.key === "]" ? 1 : -1
        );
        return;
      }

      if (event.key === "{" || event.key === "}") {
        event.preventDefault();
        void focusNextValidationIssue(event.key === "}" ? 1 : -1);
        return;
      }

      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        if (event.key !== " " && event.code !== "Space") {
          return;
        }

        if (mode !== "replay" || !syncData || replayIndex >= maxIndex) {
          return;
        }

        event.preventDefault();
        setReplayPlaying(!isReplayPlaying);
        return;
      }

      event.preventDefault();
      moveSelectedCandle(event.key === "ArrowRight" ? 1 : -1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    isReplayPlaying,
    focusAdjacentLabel,
    focusNextValidationIssue,
    maxIndex,
    mode,
    moveSelectedCandle,
    replayIndex,
    setReplayPlaying,
    syncData
  ]);

  return (
    <nav className="toolbar" aria-label="Replay controls">
      <div className="toolbar-group toolbar-zone market-zone" aria-label="Market controls">
        <span className="toolbar-zone-label">Market</span>
        {chartLayoutMode === "focused" ? (
          <span className="focus-scope-badge" aria-label={`Focused layout: ${focusedTicker} ${activeTimeframe}`}>
            Focused {focusedTicker} {activeTimeframe}
          </span>
        ) : null}
        <button type="button" disabled={isLoading || isImporting} onClick={() => void loadChartData()}>
          {isLoading ? "Loading" : "Load Charts"}
        </button>
      </div>
      <details className="toolbar-group toolbar-zone toolbar-utility-zone data-import-zone">
        <summary aria-label="Data utility controls">
          <span className="toolbar-zone-label">Data</span>
          <span className={coverageGapCount > 0 ? "toolbar-data-warning" : "coverage-badge"} role="status">
            Gaps {coverageGapCount}
          </span>
        </summary>
        <div className="toolbar-drawer" aria-label="Data import controls">
          <label className="toolbar-date-field">
            <span>From</span>
            <input
              aria-label="Import start date"
              type="text"
              inputMode="numeric"
              placeholder="YYYY-MM-DD"
              value={importStartDate}
              onChange={(event) => setImportStartDate(event.target.value)}
            />
          </label>
          <label className="toolbar-date-field">
            <span>To</span>
            <input
              aria-label="Import end date"
              type="text"
              inputMode="numeric"
              placeholder="YYYY-MM-DD"
              value={importEndDate}
              onChange={(event) => setImportEndDate(event.target.value)}
            />
          </label>
          <select
            aria-label="Import base timeframe"
            value={importBaseTimeframe}
            onChange={(event) => setImportBaseTimeframe(event.target.value as "1Min" | "5Min")}
          >
            <option value="1Min">1Min</option>
            <option value="5Min">5Min</option>
          </select>
          <button type="button" disabled={isImporting} onClick={() => void runImport()}>
            {isImporting ? "Importing" : "Import"}
          </button>
          <span className={coverageGapCount > 0 ? "toolbar-data-warning" : "coverage-badge"} role="status">
            Coverage gaps {coverageGapCount}
          </span>
          <span className="coverage-badge" aria-label="Data coverage status">
            {coverageLabel}
          </span>
          {importStatusLabel ? (
            <span
              className={importError ? "toolbar-data-warning" : "coverage-badge"}
              role="status"
              aria-label="Import status"
            >
              {importStatusLabel}
            </span>
          ) : null}
        </div>
      </details>
      <div className="toolbar-group toolbar-zone replay-zone" aria-label="Replay mode controls">
        <span className="toolbar-zone-label">Replay</span>
        <button
          className={mode === "regular" ? "active" : ""}
          type="button"
          onClick={() => setMode("regular")}
        >
          Regular
        </button>
        <button
          className={mode === "replay" ? "active" : ""}
          type="button"
          onClick={() => setMode("replay")}
        >
          Replay
        </button>
        <details className="toolbar-utility-zone replay-settings-zone">
          <summary aria-label="Replay settings">
            <span className={mode === "replay" ? "mode-badge replay" : "mode-badge regular"}>
              {mode === "replay" ? "Future hidden" : "All bars"}
            </span>
          </summary>
          <div className="toolbar-drawer replay-drawer" aria-label="Replay setup controls">
            <label className="replay-date-field">
              <span>Start</span>
              <input
                aria-label="Replay start date"
                type="text"
                inputMode="numeric"
                placeholder="YYYY-MM-DD"
                value={replayDateInput}
                disabled={!syncData}
                aria-invalid={Boolean(replayDateError)}
                onChange={(event) => setReplayStartDate(event.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={mode !== "replay" || replayIndex >= maxIndex}
              onClick={() => setReplayPlaying(!isReplayPlaying)}
            >
              {isReplayPlaying ? "Pause" : "Play"}
            </button>
            <button type="button" disabled={mode !== "replay" || replayIndex >= maxIndex} onClick={stepForward}>
              Step
            </button>
            <span className={replayDateError ? "replay-boundary error" : "replay-boundary"} role="status">
              {replayDateError ?? replayStateLabel}
            </span>
          </div>
        </details>
        <span className="sr-only">{mode === "replay" ? "Replay: future hidden" : "Regular: all bars"}</span>
      </div>
      <div className="toolbar-group toolbar-zone navigation-zone" aria-label="Candle navigation controls">
        <span className="toolbar-zone-label">Nav</span>
        <button type="button" disabled={!syncData} onClick={() => moveSelectedCandle(-1)}>
          Prev
        </button>
        <button type="button" disabled={!syncData} onClick={() => moveSelectedCandle(1)}>
          Next
        </button>
        <select
          aria-label="Replay speed"
          value={replaySpeedMs}
          onChange={(event) => setReplaySpeedMs(Number(event.target.value))}
        >
          <option value={1000}>1x</option>
          <option value={500}>2x</option>
          <option value={250}>4x</option>
        </select>
      </div>
      <div className="toolbar-group toolbar-zone session-zone" aria-label="Session status">
        <span className="toolbar-zone-label">Session</span>
        <span className="toolbar-count">
          {syncData ? `${visibleCount} / ${totalCount}` : "0 / 0"}
          {currentTimestamp ? <small>{currentTimestamp.slice(0, 10)}</small> : null}
        </span>
          {dataWarningCount > 0 ? (
            <span className="toolbar-data-warning" role="status">
              Data warnings {dataWarningCount}
            </span>
          ) : dataReviewCount > 0 ? (
            <span className="coverage-badge" role="status">
              Data review {dataReviewCount}
            </span>
          ) : null}
      </div>
      <details className="toolbar-group toolbar-zone toolbar-utility-zone export-toolbar-group">
        <summary aria-label="Export utility controls">
          <span className="toolbar-zone-label">Export</span>
          <span
            className={exportBlocked ? "toolbar-data-warning" : "coverage-badge"}
            role="status"
            aria-label="Export preview"
          >
            {exportPreviewStatus}
          </span>
        </summary>
        <div className="toolbar-drawer export-toolbar-group" aria-label="Export controls">
          <span className="sr-only">Export</span>
          <span className="toolbar-export-scope">{exportScopeLabel}</span>
          <a
            aria-disabled={!hasLabels || exportBlocked}
            className={hasLabels && !exportBlocked ? "toolbar-link" : "toolbar-link disabled"}
            href={exportHref("csv")}
            role="link"
            onClick={(event) => {
              if (!hasLabels || exportBlocked) {
                event.preventDefault();
              }
            }}
          >
            CSV
          </a>
          <a
            aria-disabled={!hasLabels || exportBlocked}
            className={hasLabels && !exportBlocked ? "toolbar-link" : "toolbar-link disabled"}
            href={exportHref("json")}
            role="link"
            onClick={(event) => {
              if (!hasLabels || exportBlocked) {
                event.preventDefault();
              }
            }}
          >
            JSON
          </a>
        </div>
      </details>
    </nav>
  );
}
