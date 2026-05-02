import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createLabel,
  deleteLabel,
  fetchBars,
  fetchLabels,
  fetchOpenTrade,
  fetchTrades,
  type Bar,
  type CaptureMode,
  type Label,
  type LabelAction,
  type LabelSource,
  type Timeframe,
  type Ticker,
  type Trade
} from "./api";
import { CapturePanel } from "./CapturePanel";
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
  const [labels, setLabels] = useState<Label[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [openTrade, setOpenTrade] = useState<Trade | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleBars = useMemo(() => mode === "replay" ? bars.slice(0, index + 1) : bars, [bars, index, mode]);

  const refreshState = useCallback(async () => {
    const [nextLabels, nextTrades, nextOpenTrade] = await Promise.all([fetchLabels(), fetchTrades(), fetchOpenTrade()]);
    setLabels(nextLabels);
    setTrades(nextTrades);
    setOpenTrade(nextOpenTrade);
  }, []);

  useEffect(() => {
    setError(null);
    fetchBars(ticker, timeframe)
      .then((nextBars) => {
        setBars(nextBars);
        const nextIndex = Math.max(0, nextBars.length - 1);
        setIndex(mode === "replay" ? 0 : nextIndex);
        setSelected(nextBars[mode === "replay" ? 0 : nextIndex] ?? null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load bars"));
  }, [mode, ticker, timeframe]);

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
    if (!selected) return;
    setError(null);
    try {
      await createLabel({
        labelSource,
        action,
        ticker,
        timeframe,
        timestamp: selected.timestamp,
        chartPrice: selected.close,
        captureMode: mode,
        visibleUntilTimestamp: mode === "replay" ? selected.timestamp : bars.at(-1)?.timestamp ?? selected.timestamp,
        potentialVisualLeakage: mode === "regular" && labelSource !== "actual_trade"
      });
      await refreshState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not capture label");
    }
  }, [bars, labelSource, mode, refreshState, selected, ticker, timeframe]);

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
      />
      <div className="workspace">
        <ChartView bars={bars} visibleBars={visibleBars} selected={selected} onSelect={selectBar} />
        <CapturePanel
          selected={selected}
          ticker={ticker}
          mode={mode}
          labelSource={labelSource}
          labels={labels}
          openTrade={openTrade}
          error={error}
          onLabelSource={setLabelSource}
          onCapture={capture}
          onUndo={undo}
        />
      </div>
      <footer className="statusbar">
        <span>{trades.length} trades</span>
        <span>{labels.filter((label) => label.training_eligible).length} training labels</span>
      </footer>
    </main>
  );
}
