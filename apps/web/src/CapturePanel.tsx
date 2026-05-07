import type { Bar, DatasetPulse, FeatureSnapshot, Label, LabelAction, LabelSource, Ticker, Trade } from "./api";
import { getCaptureBlockReason } from "./captureRules";
import { getOpenTradeSelectionContext } from "./tradeReview";

type Props = {
  selected: Bar | null;
  ticker: Ticker;
  labelSource: LabelSource;
  labels: Label[];
  selectedLabels: Label[];
  selectedFeatures: FeatureSnapshot | null;
  openTrade: Trade | null;
  error: string | null;
  captureStatus: string | null;
  nextTarget: DatasetPulse["nextTarget"] | null;
  nextAction: string | null;
  trainingCoverage: DatasetPulse["trainingCoverage"] | null;
  autoAdvance: boolean;
  executionPrice: string;
  onLabelSource: (source: LabelSource) => void;
  onAutoAdvance: (enabled: boolean) => void;
  onExecutionPrice: (value: string) => void;
  onCapture: (action: LabelAction) => void;
  onUndo: () => void;
  onGoToOpenTradeEntry: () => void;
  onGoToOpenTradeExitReview: () => void;
  onNextUnlabeled: () => void;
  onGoToLabel: (label: Label) => void;
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
  labelSource,
  labels,
  selectedLabels,
  selectedFeatures,
  openTrade,
  error,
  captureStatus,
  nextTarget,
  nextAction,
  trainingCoverage,
  autoAdvance,
  executionPrice,
  onLabelSource,
  onAutoAdvance,
  onExecutionPrice,
  onCapture,
  onUndo,
  onGoToOpenTradeEntry,
  onGoToOpenTradeExitReview,
  onNextUnlabeled,
  onGoToLabel
}: Props) {
  const lastLabels = labels.slice(-10).reverse();
  const openTradeEntryLabel = openTrade
    ? labels.find((label) => label.id === openTrade.entry_label_id)
    : null;
  const actionBlockReasons = (["ENTRY", "EXIT", "SKIP", "INVALID"] as LabelAction[]).map((action) => ({
    action,
    reason: getCaptureBlockReason(action, selected, ticker, openTrade, selectedLabels, labelSource)
  }));
  const blockedReasons = Array.from(new Set(actionBlockReasons.map((item) => item.reason).filter(Boolean)));
  const showExitFocusAction = nextTarget?.kind === "exit_coverage" && Boolean(openTradeEntryLabel);
  const showNextUnlabeledFocusAction = ["skip_coverage", "entry_coverage", "decision_coverage"].includes(nextTarget?.kind ?? "");
  const weakestYear = trainingCoverage?.weakestYears[0] ?? null;
  const weakestTickerTimeframe = trainingCoverage?.weakestTickerTimeframes[0] ?? null;
  const openTradeSelectionContext = getOpenTradeSelectionContext(selected, openTrade, ticker);
  const canMarkOpenTradeExit = openTradeSelectionContext?.tone === "active" &&
    getCaptureBlockReason("EXIT", selected, ticker, openTrade, selectedLabels, labelSource) === null;
  const featureRows: Array<[string, unknown]> = selectedFeatures ? [
    ["EMA25", selectedFeatures.ema25],
    ["SMA100", selectedFeatures.sma100],
    ["ATR14", selectedFeatures.atr14],
    ["Stoch K/D", `${formatFeatureValue(selectedFeatures.stochRsiK)} / ${formatFeatureValue(selectedFeatures.stochRsiD)}`],
    ["EMA dist", selectedFeatures.distanceToEma25Pct],
    ["5/20 return", `${formatFeatureValue(selectedFeatures.recent5ReturnPct)} / ${formatFeatureValue(selectedFeatures.recent20ReturnPct)}`],
    ["WVF", selectedFeatures.wvf],
    ["WVF band", `${formatFeatureValue(selectedFeatures.wvfUpperBand)} / ${formatFeatureValue(selectedFeatures.wvfRangeHigh)}`],
    ["WVF alerts", wvfAlertText(selectedFeatures)],
    ["SMIO", selectedFeatures.smioOscillator],
    ["SMIO S/Sig", `${formatFeatureValue(selectedFeatures.smioSmi)} / ${formatFeatureValue(selectedFeatures.smioSignal)}`],
    ["Pair", `${selectedFeatures.pairedTicker ?? "-"} ${formatFeatureValue(selectedFeatures.pairedClose)}`],
    ["Ratio", selectedFeatures.pairRatioClose],
    ["D1/H4/H2", `${biasText(selectedFeatures.d1CloseAboveEma25)} / ${biasText(selectedFeatures.h4CloseAboveEma25)} / ${biasText(selectedFeatures.h2CloseAboveEma25)}`]
  ] : [];
  return (
    <aside className="capture-panel">
      {nextTarget && nextAction ? (
        <section className="panel-section">
          <span className="eyebrow">Labeling focus</span>
          <div className="focus-card">
            <strong>{nextTarget.kind.replace(/_/g, " ")}</strong>
            <span>{nextTarget.current}/{nextTarget.target} complete · {nextTarget.remaining} remaining</span>
            <p>{nextAction}</p>
            {weakestYear || weakestTickerTimeframe ? (
              <p className="coverage-hint">
                Thin coverage: {[weakestYear ? `${weakestYear.year} (${weakestYear.rows})` : "", weakestTickerTimeframe ? `${weakestTickerTimeframe.tickerTimeframe} (${weakestTickerTimeframe.rows})` : ""].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            {showExitFocusAction ? (
              <button className="secondary compact" onClick={onGoToOpenTradeExitReview}>
                Review exit <kbd>V</kbd>
              </button>
            ) : null}
            {showNextUnlabeledFocusAction ? (
              <button className="secondary compact" onClick={onNextUnlabeled}>
                Next unlabeled <kbd>N</kbd>
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

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
            {featureRows.length > 0 ? (
              <div className="feature-grid" aria-label="Selected candle feature snapshot">
                {featureRows.map(([label, value]) => (
                  <span key={label}>
                    <strong>{label}</strong>
                    <em>{formatFeatureValue(value)}</em>
                  </span>
                ))}
              </div>
            ) : null}
            {selectedLabels.length > 0 ? (
              <div className="selected-labels" aria-label="Selected candle labels">
                {selectedLabels.map((label) => (
                  <span key={label.id} className={label.training_eligible === 1 ? "label-eligible" : "label-excluded"}>
                    {label.action} {labelSourceText[label.label_source]}
                  </span>
                ))}
              </div>
            ) : null}
            {openTradeSelectionContext ? (
              <div className={`trade-review ${openTradeSelectionContext.tone}`}>
                <strong>{openTradeSelectionContext.title}</strong>
                <span>{openTradeSelectionContext.detail}</span>
                {openTradeSelectionContext.returnPct !== null ? (
                  <span className={openTradeSelectionContext.returnPct >= 0 ? "return-positive" : "return-negative"}>
                    Marked return {openTradeSelectionContext.returnPct.toFixed(2)}%
                  </span>
                ) : null}
                {canMarkOpenTradeExit ? (
                  <button className="primary-exit" onClick={() => onCapture("EXIT")}>
                    Mark exit here <kbd>X</kbd>
                  </button>
                ) : null}
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
        <span className="badge good">
          Training eligible
        </span>
        {labelSource === "actual_trade" ? (
          <label className="field">
            <span>Execution price</span>
            <input
              inputMode="decimal"
              placeholder={selected ? selected.close.toFixed(2) : "Optional"}
              value={executionPrice}
              onChange={(event) => onExecutionPrice(event.target.value)}
            />
          </label>
        ) : null}
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
        {captureStatus ? <p className="capture-status">{captureStatus}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="panel-section">
        <span className="eyebrow">Current open trade</span>
        {openTrade ? (
          <div className="trade-card">
            <strong>Long {openTrade.ticker}</strong>
            <span>
              {openTradeEntryLabel ? `${openTradeEntryLabel.timeframe} ` : ""}
              {openTrade.entry_timestamp.slice(0, 10)} @ {openTrade.entry_price.toFixed(2)}
            </span>
            <button className="secondary compact" disabled={!openTradeEntryLabel} onClick={onGoToOpenTradeEntry}>
              Go to entry
            </button>
            <button className="secondary compact" disabled={!openTradeEntryLabel} onClick={onGoToOpenTradeExitReview}>
              Review exit <kbd>V</kbd>
            </button>
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
                <button className="label-row-button" onClick={() => onGoToLabel(label)}>
                  <strong>{label.action}</strong>
                  <span>{label.ticker} {label.timeframe} · {labelSourceText[label.label_source]}</span>
                  <span className={label.training_eligible === 1 ? "label-eligible" : "label-excluded"}>
                    {label.training_eligible === 1 ? "Eligible" : "Excluded"}
                  </span>
                  <span>{label.timestamp.slice(0, 10)}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </aside>
  );
}

function formatFeatureValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Above" : "Below";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "-";
    if (Math.abs(value) >= 1000) return value.toFixed(0);
    if (Math.abs(value) >= 10) return value.toFixed(2);
    return value.toFixed(3);
  }
  return String(value);
}

function biasText(value: unknown): string {
  if (typeof value !== "boolean") return "-";
  return value ? "Up" : "Down";
}

function wvfAlertText(features: FeatureSnapshot): string {
  const alerts = [
    features.wvfIsExtreme === true ? "extreme" : null,
    features.wvfWasExtremeNowFalse === true ? "release" : null,
    features.wvfFilteredEntry === true ? "filtered" : null,
    features.wvfAggressiveFilteredEntry === true ? "aggr" : null
  ].filter(Boolean);
  return alerts.length ? alerts.join(" / ") : "-";
}
