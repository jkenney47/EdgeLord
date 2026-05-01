# ChatGPT Pro Development Plan

## Diagnosis

EdgeLord is on the right product path: a local-first trading review workstation that turns discretionary chart review into structured decision data. The current risk is not missing TradingView features. The risk is that the UI remains too dense and dataset-health feedback stays too passive.

The next development phase should optimize three jobs:

1. Select the exact candle with no ambiguity.
2. Label quickly without losing context.
3. Turn dataset trust issues into a repair queue.

Do not start strategy mining, backtesting, broker integration, new indicators, or a larger drawing suite until these jobs are strong.

## Current Coverage

Already implemented or mostly implemented:

- SOXL/SOXS `1D`, `4H`, `2H` chart grid.
- Focused chart mode.
- Cursor and Pan chart interaction modes.
- Basic drawing tools: trendline and breakout marker.
- Label pins anchored to saved candles.
- Keyboard label shortcuts `E`, `X`, `S`, `I`.
- Selected candle object in app state.
- Session-backed labels.
- Export schema/version manifest.
- Leakage metadata for regular-mode labels.
- Setup/trade intent fields.
- Multi-timeframe context snapshots.
- Paired ETF context and ratio export fields.
- Export validation report.
- Dataset health/review panel.
- Guided repair for common entry intent and exit linkage warnings.

Partially implemented but needs hardening:

- Selected candle affordance.
- Right-panel capture-first layout.
- Post-label flow.
- Label pin visual states.
- Replay-safe labeling coverage.
- Actionable QA issue navigation.
- Viewport preservation and chart navigation ergonomics.

## Implementation Sequence

### Slice 107: Active Candle Selection Contract

Goal: Make it impossible to misunderstand what candle is being labeled.

User-visible changes:

- Strengthen the selected candle marker on the active chart.
- Add a subtle vertical selection band only for the selected candle, not hover.
- Show selected candle details at the top of Capture: ticker, timeframe, timestamp, OHLC, close change, and provenance.
- Ghost-highlight the matching timestamp on related charts when that timestamp exists.
- Keep selected candle stable when switching grid/focus.

Data/logic changes:

- Treat `selectedCandle` as the single source of truth for chart, capture panel, and label creation.
- Add a small selector/helper that returns selected candle context for the active chart and paired charts.

Acceptance criteria:

- Chart header, selected chart marker, and Capture panel always agree on ticker/timeframe/timestamp.
- Switching grid/focus preserves selected candle and viewport.
- Label creation remains blocked when no candle is selected.
- In-app browser verifies click candle -> capture details update -> label pin anchors to the same candle.

### Slice 108: Capture-First Right Panel

Goal: Reduce cognitive load during labeling.

User-visible changes:

- Reorder right panel into:
  - Active Selection / Capture.
  - Current Label / Edit Label when a saved label is selected.
  - Dataset Trust compact summary.
- Collapse dataset trust by default during capture.
- Show the top three actionable blockers/warnings instead of the full counter wall.
- Keep `Start Session`, label buttons, and selected candle details visually dominant.

Data/logic changes:

- Split right panel state into capture, edit label, and trust review presentation modes.
- No schema change unless needed for review status in later slices.

Acceptance criteria:

- With no candle selected, the panel has one clear next action.
- With a candle selected, label actions are primary and reachable without scrolling.
- Dataset trust remains visible but does not dominate the capture workflow.

### Slice 109: Post-Create Label Flow

Goal: Let users label repeatedly without panel reset or viewport jumps.

User-visible changes:

- After label save, pin appears immediately and the created label is briefly highlighted.
- Regular mode default: stay on selected candle.
- Replay mode default: advance to next candle after label save.
- Add visible `Undo last label` action.
- Last created label can be edited immediately from a compact card.

Data/logic changes:

- Centralize button and hotkey label creation through one command path.
- Add a local post-create behavior setting, initially hard-coded by mode.

Acceptance criteria:

- User can create 20 labels in a row without losing chart context.
- `E/X/S/I` and button clicks produce identical label creation behavior.
- Undo removes the last created label and refreshes review/QA counts.

### Slice 110: Label Pin States And Clustering

Goal: Make saved labels inspectable without cluttering candles.

User-visible changes:

- Normal pin: compact anchor.
- Selected pin: stronger outline and expanded badge.
- QA warning pin: subtle amber ring.
- QA blocker pin: subtle red ring.
- Overlapping pins cluster into a count badge when zoomed out.
- Hover card shows label type, price, timestamp, mode, and QA status.

Data/logic changes:

- Build a chart pin view model from labels plus validation issues.
- Map `label_id` to pin/cluster state.

Acceptance criteria:

- Every visible pin maps to one label or one cluster.
- Clicking a pin selects the correct label and opens edit context.
- Pins do not obscure candles at normal zoom.

### Slice 111: Basic Navigation Package

Goal: Add chart ergonomics without drifting into a TradingView clone.

User-visible changes:

- Cursor mode remains passive.
- Pan mode supports drag pan.
- Add double-click chart fit/reset.
- Add keyboard next/previous candle.
- Add keyboard next/previous label.
- Add keyboard next/previous QA issue.
- Preserve viewport when switching grid/focus.
- Sync x-range between grid and focused mode where practical.

Data/logic changes:

- Persist viewport state per ticker/timeframe.
- Add navigation command helpers for candle, label, and QA issue queues.

Acceptance criteria:

- User can review a session without using tiny chart buttons.
- Focus/grid transition keeps the same visible time area.
- Keyboard navigation does not interfere with typing in inputs/notes.

### Slice 112: Actionable QA Issue Queue

Goal: Turn dataset health counters into fixable issues.

User-visible changes:

- Dataset Trust shows:
  - Blockers.
  - Warnings.
  - Info/coverage.
- Top issues are shown as clickable rows.
- Clicking an issue jumps to the affected label/candle and opens the right repair UI.
- Issue rows include a short suggested fix.

Data/logic changes:

- Normalize validation output into issue objects:
  - `issue_id`
  - `severity`
  - `code`
  - `label_ids`
  - `message`
  - `suggested_fix`
- Export readiness is based on blocker severity, not raw warning count.

Acceptance criteria:

- Resolving an issue updates counts immediately.
- Issue navigation works for label-specific and dataset/global issues.
- Export readiness clearly explains what blocks or lowers trust.

### Slice 113: Replay-Clean Labeling Coverage

Goal: Make replay-safe labels visually and structurally distinct from regular labels.

User-visible changes:

- Labels show provenance badges:
  - `Regular`
  - `Replay-safe`
  - `Future-visible`
- Review panel separates replay-safe coverage from all labels.
- Capture nudges users toward replay when they are building simulation-safe data, without blocking regular review.

Data/logic changes:

- Record replay cursor, visible boundary, selected candle timestamp, and mode at label creation.
- Regular-mode labels remain allowed but are not counted as simulation-safe.

Acceptance criteria:

- A label cannot be exported as simulation-safe unless replay provenance passes.
- Leakage issues identify exact affected labels.
- Review panel shows replay-safe count separately from total labels.

### Slice 114: Setup/Trade Linkage Editor

Goal: Make entries, exits, skips, invalidations, and outcomes structurally analyzable.

User-visible changes:

- Entry labels can create or attach a trade.
- Exit labels can attach to an open trade.
- Invalidations can attach to a setup.
- Skip labels do not require trade linkage.
- Trade cards show lifecycle: open, exited, invalidated, unresolved.

Data/logic changes:

- Harden existing setup/trade fields with helpers:
  - `setup_id`
  - `trade_id`
  - `entry_label_id`
  - `exit_label_id`
- Add linkage validators.

Acceptance criteria:

- Exit without entry is flagged.
- Entry with no outcome is tracked.
- Trade lifecycle is visible and exportable.

### Slice 115: Outcome Status Separation

Goal: Keep decision data clean while supporting later analysis.

User-visible changes:

- Outcome coverage shows:
  - Not computed.
  - Pending.
  - Computed.
  - Insufficient future bars.
  - Missing exit.
  - Invalidated.

Data/logic changes:

- Keep outcomes separate from decision features.
- Add or expose `outcome_rule_version`.
- Make end-of-data insufficiency explicit.

Acceptance criteria:

- Decision export does not include future/outcome leakage as ordinary features.
- Outcome export is deterministic.
- End-of-data labels are marked insufficient, not failed.

### Slice 116: Export Preview And Manifest

Goal: Make exported datasets auditable before download.

User-visible changes:

- Export preview shows row count, filters, blockers, warnings, schema version, export timestamp, included label types, and outcome inclusion.
- Export warns or blocks when blocker-level QA issues exist.

Data/logic changes:

- Persist or return an export manifest alongside CSV/JSON.
- Include filters and QA status in manifest.

Acceptance criteria:

- Export cannot silently include blocked or leaky records.
- Exported files can be traced back to schema, session, filters, and QA status.

## Deferred Work

Defer until the label pipeline is trustworthy:

- Grid-density polish beyond obvious readability fixes.
- Annotation cleanup.
- Label templates.
- Review dashboard.
- Performance analytics.
- Win/loss summaries.
- Backtest-like reports.
- Automated pattern discovery.
- AI trade scoring.

Reject for now:

- More indicators.
- Strategy mining.
- Broker integration.
- Alerts.
- Watchlists.
- Screeners.
- Public sharing.
- Cloud sync.
- Custom scripting.
- Full drawing toolkit.
- Theme/layout customization rabbit hole.

## Next Recommended Slice

Start with **Slice 107: Active Candle Selection Contract**.

Reason: it directly supports everything else. If selected-candle state is ambiguous, fast labeling, QA repair, linkage, and export trust all become weaker.
