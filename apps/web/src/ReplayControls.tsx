import type { CaptureMode, Timeframe, Ticker } from "./api";
import { exportUrl } from "./api";

type Props = {
  ticker: Ticker;
  timeframe: Timeframe;
  mode: CaptureMode;
  index: number;
  total: number;
  jumpDate: string;
  onTicker: (ticker: Ticker) => void;
  onTimeframe: (timeframe: Timeframe) => void;
  onMode: (mode: CaptureMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onJumpDate: (value: string) => void;
  onJump: () => void;
  onResume: () => void;
  onNextUnlabeled: () => void;
  onImportCsv: (file: File) => void;
  importStatus: string | null;
};

export function ReplayControls({
  ticker,
  timeframe,
  mode,
  index,
  total,
  jumpDate,
  onTicker,
  onTimeframe,
  onMode,
  onPrev,
  onNext,
  onJumpDate,
  onJump,
  onResume,
  onNextUnlabeled,
  onImportCsv,
  importStatus
}: Props) {
  return (
    <header className="topbar">
      <div className="segmented" aria-label="Ticker">
        {(["SOXL", "SOXS"] as Ticker[]).map((item) => (
          <button key={item} className={ticker === item ? "active" : ""} onClick={() => onTicker(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="segmented" aria-label="Timeframe">
        {(["1D", "4H", "2H"] as Timeframe[]).map((item) => (
          <button key={item} className={timeframe === item ? "active" : ""} onClick={() => onTimeframe(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="segmented" aria-label="Mode">
        <button className={mode === "replay" ? "active" : ""} onClick={() => onMode("replay")}>Replay</button>
        <button className={mode === "regular" ? "active" : ""} onClick={() => onMode("regular")}>Regular</button>
      </div>
      <button onClick={onPrev} disabled={index <= 0}>Prev</button>
      <button onClick={onNext} disabled={index >= total - 1}>Next</button>
      <label className="jump-date">
        <span>Jump Date</span>
        <input value={jumpDate} placeholder="YYYY-MM-DD" onChange={(event) => onJumpDate(event.target.value)} />
      </label>
      <button onClick={onJump}>Jump</button>
      <button onClick={onResume} disabled={total === 0}>Resume</button>
      <button onClick={onNextUnlabeled} disabled={index >= total - 1}>Next unlabeled</button>
      <label className="file-import">
        <span>Import CSV</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onImportCsv(file);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <details className="export-menu">
        <summary>Export</summary>
        <div>
          <a href={exportUrl("labels.csv")}>Labels CSV</a>
          <a href={exportUrl("trades.csv")}>Trades CSV</a>
          <a href={exportUrl("training-features.csv")}>Training CSV</a>
          <a href={exportUrl("trade-candidates.csv")}>Trade Candidates CSV</a>
          <a href={exportUrl("labels.jsonl")}>Labels JSONL</a>
          <a href={exportUrl("manifest.json")}>Manifest JSON</a>
          <a href={exportUrl("schema.json")}>Schema JSON</a>
        </div>
      </details>
      {importStatus ? <span className="import-status">{importStatus}</span> : null}
      <span className="progress">{total === 0 ? "0 / 0" : `${index + 1} / ${total}`}</span>
    </header>
  );
}
