import type { Bar, CaptureMode, Label, LabelAction, LabelSource, Ticker, Trade } from "./api";
import { getCaptureBlockReason } from "./captureRules";

type Props = {
  selected: Bar | null;
  ticker: Ticker;
  mode: CaptureMode;
  labelSource: LabelSource;
  labels: Label[];
  selectedLabels: Label[];
  openTrade: Trade | null;
  error: string | null;
  autoAdvance: boolean;
  onLabelSource: (source: LabelSource) => void;
  onAutoAdvance: (enabled: boolean) => void;
  onCapture: (action: LabelAction) => void;
  onUndo: () => void;
};

const actionKeys: Record<LabelAction, string> = {
  ENTRY: "E",
  EXIT: "X",
  SKIP: "S",
  INVALID: "I"
};

const labelSourceText: Record<LabelSource, string> = {
  actual_trade: "Actual",
  retrospective_replay: "Replay",
  retrospective_hindsight: "Hindsight"
};

export function CapturePanel({
  selected,
  ticker,
  mode,
  labelSource,
  labels,
  selectedLabels,
  openTrade,
  error,
  autoAdvance,
  onLabelSource,
  onAutoAdvance,
  onCapture,
  onUndo
}: Props) {
  const lastLabels = labels.slice(-10).reverse();
  const actionBlockReasons = (["ENTRY", "EXIT", "SKIP", "INVALID"] as LabelAction[]).map((action) => ({
    action,
    reason: getCaptureBlockReason(action, selected, ticker, openTrade)
  }));
  const blockedReasons = Array.from(new Set(actionBlockReasons.map((item) => item.reason).filter(Boolean)));
  return (
    <aside className="capture-panel">
      <section className="panel-section">
        <span className="eyebrow">Selected candle</span>
        {selected ? (
          <div className="selected-card">
            <strong>{selected.ticker} {selected.timeframe}</strong>
            <span>{new Date(selected.timestamp).toLocaleString()}</span>
            <div className="ohlc">
              <span>O {selected.open.toFixed(2)}</span>
              <span>H {selected.high.toFixed(2)}</span>
              <span>L {selected.low.toFixed(2)}</span>
              <span>C {selected.close.toFixed(2)}</span>
            </div>
            {selectedLabels.length > 0 ? (
              <div className="selected-labels" aria-label="Selected candle labels">
                {selectedLabels.map((label) => (
                  <span key={label.id} className={label.training_eligible === 1 ? "label-eligible" : "label-excluded"}>
                    {label.action} {labelSourceText[label.label_source]}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p>Select a candle to label.</p>
        )}
      </section>

      <section className="panel-section">
        <label className="field">
          <span>Label source</span>
          <select value={labelSource} onChange={(event) => onLabelSource(event.target.value as LabelSource)}>
            <option value="actual_trade">Actual trade</option>
            <option value="retrospective_replay">Retrospective replay</option>
            <option value="retrospective_hindsight">Retrospective hindsight</option>
          </select>
        </label>
        <span className={mode === "replay" && labelSource !== "retrospective_hindsight" ? "badge good" : "badge warn"}>
          {labelSource === "actual_trade" || (mode === "replay" && labelSource === "retrospective_replay")
            ? "Training eligible"
            : "Excluded by default"}
        </span>
        <label className="toggle-row">
          <input type="checkbox" checked={autoAdvance} onChange={(event) => onAutoAdvance(event.target.checked)} />
          <span>Auto-advance</span>
        </label>
      </section>

      <section className="panel-section">
        <div className="action-grid">
          {actionBlockReasons.map(({ action, reason }) => (
            <button key={action} disabled={Boolean(reason)} title={reason ?? `${action} ${actionKeys[action]}`} onClick={() => onCapture(action)}>
              {action}
              <kbd>{actionKeys[action]}</kbd>
            </button>
          ))}
        </div>
        {blockedReasons.length > 0 ? (
          <div className="blocked-reasons" aria-label="Blocked actions">
            {blockedReasons.map((reason) => (
              <p key={reason}>{reason}</p>
            ))}
          </div>
        ) : null}
        <button className="secondary" disabled={labels.length === 0} onClick={onUndo}>Undo last label <kbd>U</kbd></button>
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="panel-section">
        <span className="eyebrow">Current open trade</span>
        {openTrade ? (
          <div className="trade-card">
            <strong>Long {openTrade.ticker}</strong>
            <span>{openTrade.entry_timestamp.slice(0, 10)} @ {openTrade.entry_price.toFixed(2)}</span>
          </div>
        ) : (
          <p>Flat</p>
        )}
      </section>

      <section className="panel-section">
        <span className="eyebrow">Last 10 labels</span>
        {lastLabels.length === 0 ? (
          <p>No labels yet.</p>
        ) : (
          <ol className="label-list">
            {lastLabels.map((label) => (
              <li key={label.id}>
                <strong>{label.action}</strong>
                <span>{label.ticker} {label.timeframe} · {labelSourceText[label.label_source]}</span>
                <span className={label.training_eligible === 1 ? "label-eligible" : "label-excluded"}>
                  {label.training_eligible === 1 ? "Eligible" : "Excluded"}
                </span>
                <span>{label.timestamp.slice(0, 10)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </aside>
  );
}
