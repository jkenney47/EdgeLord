import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createLabel,
  deleteLabel,
  fetchBars,
  fetchBarsSummary,
  fetchLabels,
  fetchOpenTrade,
  fetchTrades,
  importCsv,
  type Bar,
  type BarSummaryRow,
  type CaptureMode,
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
import { ReplayControls } from "./ReplayControls";

export function App() {
  const [ticker, setTicker] = useState<Ticker>("SOXL");
  const [timeframe, setTimeframe] = useState<Timeframe>("4H");
  const [mode, setMode] = useState<CaptureMode>("replay");
  const [bars, setBars] = useState<Bar[]>([]);
  const [selected, setSelected] = useState<Bar | null>(null);
  const [index, setIndex] = useState(0);
  const [jumpDate, setJumpDate] = useState("");
  const [labelSource, setLabelSource] = useState<LabelSource>("retrospective_replay");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [labels, setLabels] = useState<Label[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [openTrade, setOpenTrade] = useState<Trade | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [barSummary, setBarSummary] = useState<BarSummaryRow[]>([]);

  const visibleBars = useMemo(() => mode === "replay" ? bars.slice(0, index + 1) : bars, [bars, index, mode]);
  const labelStats = useMemo(() => ({
    eligible: labels.filter((label) => label.training_eligible === 1).length,
    ineligible: labels.filter((label) => label.training_eligible !== 1).length,
    entries: labels.filter((label) => label.action === "ENTRY").length,
    exits: labels.filter((label) => label.action === "EXIT").length,
    skips: labels.filter((label) => label.action === "SKIP").length
  }), [labels]);
  const closedTrades = useMemo(() => trades.filter((trade) => trade.status === "closed").length, [trades]);
  const selectedLabels = useMemo(() => {
    if (!selected) return [];
    return labels.filter((label) =>
      label.ticker === selected.ticker &&
      label.timeframe === selected.timeframe &&
      label.timestamp === selected.timestamp
    );
  }, [labels, selected]);
  const dataReadiness = useMemo(() => {
    const rawRows = barSummary.filter((row) => row.timeframe === "RAW");
    const chartRows = barSummary.filter((row) => row.timeframe !== "RAW");
    const rawSources = new Set(rawRows.map((row) => row.source));
    const chartCombos = new Set(chartRows.map((row) => `${row.ticker}:${row.timeframe}`));
    const spans = chartRows
      .filter((row) => row.first && row.last)
      .map((row) => (new Date(row.last as string).getTime() - new Date(row.first as string).getTime()) / 86_400_000);
    const shortestSpan = spans.length ? Math.min(...spans) : 0;

    if (chartCombos.size < 6) return { tone: "warn", text: "Data incomplete" };
    if (rawSources.size === 1 && rawSources.has("sample")) return { tone: "warn", text: "Sample data only" };
    if (rawSources.has("sample") && rawSources.has("csv")) return { tone: "warn", text: "Mixed sample/csv data" };
    if (rawSources.size === 0) return { tone: "warn", text: "Chart cache only" };
    if (shortestSpan < 365) return { tone: "warn", text: `Short data ${shortestSpan.toFixed(0)}d` };
    if (shortestSpan < 365 * 5) return { tone: "warn", text: `Early data ${Math.floor(shortestSpan / 365)}y` };
    return { tone: "good", text: `Data ${Math.floor(shortestSpan / 365)}y` };
  }, [barSummary]);

  const refreshState = useCallback(async () => {
    const [nextLabels, nextTrades, nextOpenTrade] = await Promise.all([fetchLabels(), fetchTrades(), fetchOpenTrade()]);
    setLabels(nextLabels);
    setTrades(nextTrades);
    setOpenTrade(nextOpenTrade);
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

  const refreshBarSummary = useCallback(async () => {
    try {
      setBarSummary(await fetchBarsSummary());
    } catch {
      setBarSummary([]);
    }
  }, []);

  useEffect(() => {
    void loadBars();
  }, [loadBars]);

  useEffect(() => {
    void refreshBarSummary();
  }, [refreshBarSummary]);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

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

  const capture = useCallback(async (action: LabelAction) => {
    const blockReason = getCaptureBlockReason(action, selected, ticker, openTrade);
    if (blockReason) {
      setError(blockReason);
      return;
    }
    const activeBar = selected;
    if (!activeBar) return;
    setError(null);
    try {
      await createLabel({
        labelSource,
        action,
        ticker,
        timeframe,
        timestamp: activeBar.timestamp,
        chartPrice: activeBar.close,
        captureMode: mode,
        visibleUntilTimestamp: mode === "replay" ? activeBar.timestamp : bars.at(-1)?.timestamp ?? activeBar.timestamp,
        potentialVisualLeakage: mode === "regular" && labelSource !== "actual_trade"
      });
      await refreshState();
      if (autoAdvance && mode === "replay") {
        move(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not capture label");
    }
  }, [autoAdvance, bars, labelSource, mode, move, openTrade, refreshState, selected, ticker, timeframe]);

  const undo = useCallback(async () => {
    const last = labels.at(-1);
    if (!last) return;
    await deleteLabel(last.id);
    await refreshState();
  }, [labels, refreshState]);

  const jump = useCallback(() => {
    const nextIndex = bars.findIndex((bar) => bar.timestamp.slice(0, 10) >= jumpDate);
    if (nextIndex >= 0) {
      setIndex(nextIndex);
      setSelected(bars[nextIndex]);
    }
  }, [bars, jumpDate]);

  const handleImportCsv = useCallback(async (file: File) => {
    setError(null);
    setImportStatus(`Importing ${file.name}`);
    try {
      const csv = await file.text();
      const result = await importCsv(csv, { replaceBars: true });
      const replaced = result.replacedBars ? `, replaced ${result.replacedBars}` : "";
      setImportStatus(`Imported ${result.rawInserted} raw / ${result.aggregateInserted} chart bars${replaced}`);
      await loadBars();
      await refreshBarSummary();
      await refreshState();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not import CSV";
      setError(message);
      setImportStatus("Import failed");
    }
  }, [loadBars, refreshBarSummary, refreshState]);

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
  }, [capture, move, undo]);

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
          autoAdvance={autoAdvance}
          onLabelSource={setLabelSource}
          onAutoAdvance={setAutoAdvance}
          onCapture={capture}
          onUndo={undo}
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
        <span className={`data-readiness ${dataReadiness.tone}`}>{dataReadiness.text}</span>
      </footer>
    </main>
  );
}
