# EdgeLord Strategy Discovery Pivot

## Verdict

EdgeLord should stop expanding as a TradingView-style workstation and pivot to a replay-safe label factory for strategy discovery.

The product is the dataset and resulting rule engine. The app is only the tool used to create clean discretionary decisions.

## Hard Gate

No new charting features, drawing features, dashboard features, responsive polish, broker features, new indicators, or strategy-mining UI until there are at least 300 replay-safe decision labels.

Allowed work before that gate:

- Reduce labeling friction.
- Make replay-safe capture the default.
- Improve simple label exports and modeling exports.
- Add research scripts that inspect exported data.
- Fix bugs that corrupt labels, leakage metadata, imports, aggregation, indicators, validation, or exports.

## Keep Central

- Alpaca import and local bar cache.
- RTH calendar logic.
- `1Min` / `5Min` source import.
- `2H`, `4H`, and `1D` aggregation.
- SOXL/SOXS focused workflow.
- Existing indicator engine: EMA 25, SMA 100, monthly VWAP, ATR, SMIO, Stoch RSI, and CM WVF.
- Replay and leakage metadata: `captureMode`, `visibleUntilTimestamp`, and `potentialVisualLeakage`.
- Export manifest/versioning.
- Export validation.

## Historical Data Backfill

The research target is split-adjusted SOXL/SOXS coverage from 2011-present. Use the repo runner instead of clicking through the UI:

```bash
pnpm backfill:soxl-soxs -- --start 2011-01-01 --end 2026-05-01
pnpm backfill:soxl-soxs -- --start 2011-01-01 --end 2026-05-01 --execute
```

The command defaults to dry-run and imports in calendar-year batches when `--execute` is supplied. It requires the API server to be running with Alpaca credentials configured. The provider requests adjusted bars by default. Use `--chunk-delay-ms 750` or higher when running multi-year imports to avoid provider rate limits.

Current local backfill result from the configured Alpaca access:

- Target attempted: `2011-01-01` through `2026-05-01`.
- `2011` through `2019`: no aligned SOXL/SOXS aggregate coverage returned.
- `2020`: partial raw bars returned, but no aligned SOXL/SOXS aggregates.
- Usable aligned aggregate coverage starts in early `2021` and extends through `2026-05-01`.

This is enough to continue labeling and pipeline work, but it is not enough for the 2011-present research target. The next data decision is outside the repo: enable an Alpaca historical data feed/plan that can return adjusted SOXL/SOXS history for the full target range, likely `ALPACA_DATA_FEED=sip` if the account supports it, or use another adjusted historical provider.

## Demote For Now

These areas should stay hidden, collapsed, frozen, or secondary until useful labels exist:

- Full TradingView-style polish.
- Multi-panel desktop grid as the default surface.
- Drawing tool polish.
- Dataset Trust dashboard as a primary UI.
- Outcome calculation UI.
- Trade lifecycle cards.
- Export preview complexity in the toolbar.
- Narrow/mobile polish.
- Slice treadmill work that does not directly improve labeling throughput or research readiness.

## Minimal Labeling UI

Default screen:

- Top: Load data, Regular/Replay, Prev, Next, Export.
- Center: one focused chart for SOXL/SOXS on `1D`, `4H`, or `2H`.
- Right: selected candle, `Entry`, `Exit`, `Skip`, `Invalid`, undo, last 5 labels.

Default behavior:

- Start in replay mode for training labels.
- Select one candle at a time.
- `E` creates `ENTRY`.
- `X` creates `EXIT`.
- `S` creates `SKIP`.
- `I` creates `INVALID`.
- `U` undoes the last label.
- Details, Session, Review, Data, and Export stay collapsed unless needed.

## MVP Label Contract

The database can stay wider than this, but this is the mental model for the first research dataset:

```ts
type DecisionLabel = {
  id: string;
  sessionId: string;
  ticker: "SOXL" | "SOXS";
  timeframe: "1D" | "4H" | "2H";
  timestamp: string;
  barIndex: number;
  price: number;
  labelType: "ENTRY" | "EXIT" | "SKIP" | "INVALID";
  captureMode: "replay" | "regular";
  visibleUntilTimestamp: string;
  potentialVisualLeakage: boolean;
  tradeId?: string | null;
  parentLabelId?: string | null;
  direction?: "long_ticker" | "short_ticker" | "observe_only";
  confidence?: number;
  setupQuality?: number;
  reasonCodes?: string[];
  notes?: string | null;
  featureVersion: string;
  features: Record<string, number | string | boolean | null>;
  createdAt: string;
};
```

## Export Shape

Use three research-facing outputs:

- `labels.jsonl`: one human decision per line for inspection.
- `decision_features.csv`: one reviewed candidate bar per row for modeling.
- `trades.csv`: one completed trade idea per row for outcome evaluation.

Keep future outcome fields out of training features. Outcome data is evaluation-only.

## Research Sequence

1. Collect replay-safe labels.
2. Include skips or define reviewed non-entry bars as negative examples.
3. Generate features using only data visible at `visibleUntilTimestamp`.
4. Start with interpretable rule discovery: shallow decision trees, logistic regression, feature frequency, and simple rule search.
5. Evaluate only with time-based train/validate/test splits.
6. Convert candidate rules into code only after they survive walk-forward testing.

## Open Product Decisions

Answer these before substantial strategy logic or UI rebuild work:

- Are labels for actual trades taken, or trades that would have been taken during chart review?
- Should the algorithm trade SOXL only, SOXS only, or switch between both?
- Does `EXIT` mean close a trade, reverse direction, or stop being interested?
- Are `SKIP` labels required for bars seriously considered and rejected? Default: yes.
- Should regular-mode labels be excluded from training by default? Default: yes.
- What is the minimum useful algorithm output: human-readable rules, Python backtest, TypeScript signal function, Pine Script, or broker-executable bot?
- Should the model match discretionary decisions or maximize tested return when those diverge?
- What is the target holding period: same bar, next `2H` candle, multi-day swing, or explicit exit?
- Are trendline breaks essential, or can recent high/low, slope, and breakout features approximate them?
- How many labels will be collected before expecting real rule discovery?
