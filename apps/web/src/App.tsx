import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createLabel,
  deleteLabel,
  fetchBars,
  fetchDatasetPulse,
  fetchLabels,
  fetchOpenTrade,
  fetchTrades,
  importCsv,
  type Bar,
  type CaptureMode,
  type DatasetPulse,
  type Label,
  type LabelAction,
  type LabelSource,
  type Timeframe,
  type Ticker,
  type Trade
} from "./api";
import { CapturePanel } from "./CapturePanel";
import { getCaptureBlockReason } from "./captureRules";
import { ChartView } from "./ChartView";
import { findFirstIndexAfterTimestamp, findNextUnlabeledIndex, findReplayResumeIndex } from "./replayNavigation";
import { ReplayControls } from "./ReplayControls";

type PendingSelection = {
  ticker: Ticker;
  timeframe: Timeframe;
  timestamp?: string;
  afterTimestamp?: string;
  status: string;
};

export function App() {
  const [ticker, setTicker] = useState<Ticker>("SOXL");
  const [timeframe, setTimeframe] = useState<Timeframe>("4H");
  const [mode, setMode] = useState<CaptureMode>("replay");
  const [bars, setBars] = useState<Bar[]>([]);
  const [selected, setSelected] = useState<Bar | null>(null);
  const [index, setIndex] = useState(0);
  const [jumpDate, setJumpDate] = useState("");
  const [labelSource, setLabelSource] = useState<LabelSource>("retrospective_replay");
  const [executionPrice, setExecutionPrice] = useState("");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [labels, setLabels] = useState<Label[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [openTrade, setOpenTrade] = useState<Trade | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [datasetPulse, setDatasetPulse] = useState<DatasetPulse | null>(null);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);

  const visibleBars = useMemo(() => mode === "replay" ? bars.slice(0, index + 1) : bars, [bars, index, mode]);
  const labelStats = useMemo(() => ({
    eligible: datasetPulse?.labels.trainingEligible ?? labels.filter((label) => label.training_eligible === 1).length,
    ineligible: datasetPulse?.labels.excluded ?? labels.filter((label) => label.training_eligible !== 1).length,
    entries: datasetPulse?.labels.actions.ENTRY ?? labels.filter((label) => label.action === "ENTRY").length,
    exits: datasetPulse?.labels.actions.EXIT ?? labels.filter((label) => label.action === "EXIT").length,
    skips: datasetPulse?.labels.actions.SKIP ?? labels.filter((label) => label.action === "SKIP").length
  }), [datasetPulse, labels]);
  const closedTrades = datasetPulse?.trades.closed ?? trades.filter((trade) => trade.status === "closed").length;
  const targets = datasetPulse?.targets ?? [];
  const dataReadiness = datasetPulse?.dataReadiness ?? { tone: "warn" as const, text: "Checking data" };
  const nextTarget = datasetPulse?.nextTarget ?? null;
  const nextAction = datasetPulse?.nextActions[0] ?? null;
  const selectedLabels = useMemo(() => {
    if (!selected) return [];
    return labels.filter((label) =>
      label.ticker === selected.ticker &&
      label.timeframe === selected.timeframe &&
      label.timestamp === selected.timestamp
    );
  }, [labels, selected]);
  const refreshState = useCallback(async () => {
    const [nextLabels, nextTrades, nextOpenTrade, nextDatasetPulse] = await Promise.all([
      fetchLabels(),
      fetchTrades(),
      fetchOpenTrade(),
      fetchDatasetPulse()
    ]);
    setLabels(nextLabels);
    setTrades(nextTrades);
    setOpenTrade(nextOpenTrade);
    setDatasetPulse(nextDatasetPulse);
  }, []);

  const loadBars = useCallback(async () => {
    setError(null);
    try {
      const nextBars = await fetchBars(ticker, timeframe);
      setBars(nextBars);
      const nextIndex = Math.max(0, nextBars.length - 1);
      setIndex(mode === "replay" ? 0 : nextIndex);
      setSelected(nextBars[mode === "replay" ? 0 : nextIndex] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load bars");
    }
  }, [mode, ticker, timeframe]);

  useEffect(() => {
    void loadBars();
  }, [loadBars]);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  useEffect(() => {
    if (!pendingSelection || pendingSelection.ticker !== ticker || pendingSelection.timeframe !== timeframe) return;
    const nextIndex = pendingSelection.afterTimestamp
      ? findFirstIndexAfterTimestamp(bars, pendingSelection.afterTimestamp)
      : bars.findIndex((bar) => bar.timestamp === pendingSelection.timestamp);
    if (nextIndex !== null && nextIndex >= 0) {
      setIndex(nextIndex);
      setSelected(bars[nextIndex]);
      setCaptureStatus(pendingSelection.status);
      setPendingSelection(null);
    }
  }, [bars, pendingSelection, ticker, timeframe]);

  useEffect(() => {
    if (mode === "replay") {
      setLabelSource("retrospective_replay");
    } else if (labelSource === "retrospective_replay") {
      setLabelSource("retrospective_hindsight");
    }
  }, [labelSource, mode]);

  const selectBar = useCallback((bar: Bar) => {
    const nextIndex = bars.findIndex((item) => item.timestamp === bar.timestamp);
    if (nextIndex >= 0) setIndex(nextIndex);
    setSelected(bar);
  }, [bars]);

  const move = useCallback((delta: number) => {
    setIndex((current) => {
      const next = Math.min(Math.max(current + delta, 0), Math.max(0, bars.length - 1));
      setSelected(bars[next] ?? null);
      return next;
    });
  }, [bars]);

  const selectTimestamp = useCallback((timestamp: string) => {
    const nextIndex = bars.findIndex((bar) => bar.timestamp === timestamp);
    if (nextIndex >= 0) {
      setIndex(nextIndex);
      setSelected(bars[nextIndex]);
    }
  }, [bars]);

  const capture = useCallback(async (action: LabelAction) => {
    const blockReason = getCaptureBlockReason(action, selected, ticker, openTrade);
    if (blockReason) {
      setError(blockReason);
      return;
    }
    const activeBar = selected;
    if (!activeBar) return;
    const trimmedExecutionPrice = executionPrice.trim();
    const parsedExecutionPrice = trimmedExecutionPrice === "" ? null : Number(trimmedExecutionPrice);
    if (trimmedExecutionPrice !== "" && !Number.isFinite(parsedExecutionPrice)) {
      setError("Execution price must be a number.");
      return;
    }
    setError(null);
    setCaptureStatus(null);
    try {
      const result = await createLabel({
        labelSource,
        action,
        ticker,
        timeframe,
        timestamp: activeBar.timestamp,
        chartPrice: activeBar.close,
        executionPrice: labelSource === "actual_trade" ? parsedExecutionPrice : null,
        captureMode: mode,
        visibleUntilTimestamp: mode === "replay" ? activeBar.timestamp : bars.at(-1)?.timestamp ?? activeBar.timestamp,
        potentialVisualLeakage: mode === "regular" && labelSource !== "actual_trade"
      });
      await refreshState();
      const shouldAdvance = autoAdvance && mode === "replay" && index < bars.length - 1;
      setCaptureStatus(`${result.label.action} saved${shouldAdvance ? "; advanced" : ""}.`);
      if (shouldAdvance) {
        move(1);
      }
      if (labelSource === "actual_trade") {
        setExecutionPrice("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not capture label");
    }
  }, [autoAdvance, bars, executionPrice, index, labelSource, mode, move, openTrade, refreshState, selected, ticker, timeframe]);

  const undo = useCallback(async () => {
    setError(null);
    setCaptureStatus(null);
    try {
      const latestLabels = await fetchLabels();
      const last = latestLabels.at(-1);
      if (!last) return;
      await deleteLabel(last.id);
      selectTimestamp(last.timestamp);
      await refreshState();
      setCaptureStatus(`Undid ${last.action}; returned to candle.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not undo last label");
    }
  }, [refreshState, selectTimestamp]);

  const jump = useCallback(() => {
    const nextIndex = bars.findIndex((bar) => bar.timestamp.slice(0, 10) >= jumpDate);
    if (nextIndex >= 0) {
      setIndex(nextIndex);
      setSelected(bars[nextIndex]);
    }
  }, [bars, jumpDate]);

  const resumeReplay = useCallback(() => {
    const nextIndex = findReplayResumeIndex(bars, labels, ticker, timeframe);
    setIndex(nextIndex);
    setSelected(bars[nextIndex] ?? null);
    setCaptureStatus(bars[nextIndex] ? `Resumed at ${bars[nextIndex].timestamp.slice(0, 10)}.` : null);
  }, [bars, labels, ticker, timeframe]);

  const nextUnlabeled = useCallback(() => {
    const nextIndex = findNextUnlabeledIndex(bars, labels, ticker, timeframe, index);
    if (nextIndex === null) {
      setCaptureStatus("No later unlabeled candle.");
      return;
    }
    setIndex(nextIndex);
    setSelected(bars[nextIndex] ?? null);
    setCaptureStatus(`Next unlabeled ${bars[nextIndex].timestamp.slice(0, 10)}.`);
  }, [bars, index, labels, ticker, timeframe]);

  const goToOpenTradeEntry = useCallback(() => {
    setError(null);
    if (!openTrade) return;
    const entryLabel = labels.find((label) => label.id === openTrade.entry_label_id);
    if (!entryLabel) {
      setError("Open trade entry label is missing.");
      return;
    }
    setPendingSelection({
      ticker: entryLabel.ticker,
      timeframe: entryLabel.timeframe,
      timestamp: entryLabel.timestamp,
      status: `Selected open trade entry ${entryLabel.timestamp.slice(0, 10)}.`
    });
    setMode("replay");
    setTicker(entryLabel.ticker);
    setTimeframe(entryLabel.timeframe);
  }, [labels, openTrade]);

  const goToOpenTradeExitReview = useCallback(() => {
    setError(null);
    if (!openTrade) return;
    const entryLabel = labels.find((label) => label.id === openTrade.entry_label_id);
    if (!entryLabel) {
      setError("Open trade entry label is missing.");
      return;
    }
    setPendingSelection({
      ticker: entryLabel.ticker,
      timeframe: entryLabel.timeframe,
      afterTimestamp: entryLabel.timestamp,
      status: `Reviewing exit after ${entryLabel.timestamp.slice(0, 10)}.`
    });
    setMode("replay");
    setTicker(entryLabel.ticker);
    setTimeframe(entryLabel.timeframe);
  }, [labels, openTrade]);

  const goToLabel = useCallback((label: Label) => {
    setError(null);
    setPendingSelection({
      ticker: label.ticker,
      timeframe: label.timeframe,
      timestamp: label.timestamp,
      status: `Selected ${label.action} label ${label.timestamp.slice(0, 10)}.`
    });
    setMode("replay");
    setTicker(label.ticker);
    setTimeframe(label.timeframe);
  }, []);

  const handleImportCsv = useCallback(async (file: File) => {
    setError(null);
    setImportStatus(`Importing ${file.name}`);
    try {
      const csv = await file.text();
      const result = await importCsv(csv, { replaceBars: true });
      const replaced = result.replacedBars ? `, replaced ${result.replacedBars}` : "";
      setImportStatus(`Imported ${result.rawInserted} raw / ${result.aggregateInserted} chart bars${replaced}`);
      await loadBars();
      await refreshState();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not import CSV";
      setError(message);
      setImportStatus("Import failed");
    }
  }, [loadBars, refreshState]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
      } else if (event.key.toLowerCase() === "u") {
        event.preventDefault();
        void undo();
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        resumeReplay();
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        nextUnlabeled();
      } else if (event.key.toLowerCase() === "v") {
        event.preventDefault();
        goToOpenTradeExitReview();
      } else {
        const action = ({ e: "ENTRY", x: "EXIT", s: "SKIP", i: "INVALID" } as Record<string, LabelAction>)[event.key.toLowerCase()];
        if (action) {
          event.preventDefault();
          void capture(action);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [capture, goToOpenTradeExitReview, move, nextUnlabeled, resumeReplay, undo]);

  return (
    <main className="app-shell">
      <ReplayControls
        ticker={ticker}
        timeframe={timeframe}
        mode={mode}
        index={index}
        total={bars.length}
        jumpDate={jumpDate}
        onTicker={setTicker}
        onTimeframe={setTimeframe}
        onMode={setMode}
        onPrev={() => move(-1)}
        onNext={() => move(1)}
        onJumpDate={setJumpDate}
        onJump={jump}
        onResume={resumeReplay}
        onNextUnlabeled={nextUnlabeled}
        onImportCsv={(file) => void handleImportCsv(file)}
        importStatus={importStatus}
      />
      <div className="workspace">
        <ChartView bars={bars} visibleBars={visibleBars} selected={selected} onSelect={selectBar} />
        <CapturePanel
          selected={selected}
          ticker={ticker}
          mode={mode}
          labelSource={labelSource}
          labels={labels}
          selectedLabels={selectedLabels}
          openTrade={openTrade}
          error={error}
          captureStatus={captureStatus}
          autoAdvance={autoAdvance}
          executionPrice={executionPrice}
          onLabelSource={setLabelSource}
          onAutoAdvance={setAutoAdvance}
          onExecutionPrice={setExecutionPrice}
          onCapture={capture}
          onUndo={undo}
          onGoToOpenTradeEntry={goToOpenTradeEntry}
          onGoToOpenTradeExitReview={goToOpenTradeExitReview}
          onGoToLabel={goToLabel}
        />
      </div>
      <footer className="statusbar">
        <span>Closed {closedTrades}</span>
        <span>{openTrade ? `Open ${openTrade.ticker}` : "Flat"}</span>
        <span>Eligible {labelStats.eligible}</span>
        <span>Entries {labelStats.entries}</span>
        <span>Exits {labelStats.exits}</span>
        <span>Skips {labelStats.skips}</span>
        <span>Excluded {labelStats.ineligible}</span>
        {targets.map((target) => (
          <span key={target.key} className={target.complete ? "target-chip complete" : "target-chip"}>
            {target.label} {target.current}/{target.target}
          </span>
        ))}
        <span className={`data-readiness ${dataReadiness.tone}`}>{dataReadiness.text}</span>
        {nextTarget ? (
          <span className="next-target">
            Next {nextTarget.kind.replace(/_/g, " ")} {nextTarget.current}/{nextTarget.target}
          </span>
        ) : null}
        {nextAction ? <span className="next-action">{nextAction}</span> : null}
      </footer>
    </main>
  );
}
