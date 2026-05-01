# EdgeLord Consultant Implementation Plan

## Consultant Input Used

- Model/tool: ChatGPT Pro, manually submitted by the user.
- Date: 2026-04-27.
- Prompt objective: red-team EdgeLord's visual trading workstation direction, data model, export shape, leakage controls, and next implementation sequence.
- Visual artifacts sent:
  - `artifacts/chatgpt-consultant/2026-04-27-edgelord-ux-architecture/desktop-grid.png`
  - `artifacts/chatgpt-consultant/2026-04-27-edgelord-ux-architecture/focused-soxl-4h.png`
  - `artifacts/chatgpt-consultant/2026-04-27-edgelord-ux-architecture/narrow-focused-soxl-4h.png`
- Raw consultant output:
  - `artifacts/chatgpt-consultant/2026-04-27-edgelord-ux-architecture/raw-response.md`

## Recommendation

Accept the consultant's main direction.

EdgeLord should stay a visual replay workstation with structured data underneath. Do not pivot to spreadsheet-only labeling. Do not expand toward a full TradingView clone. The next work should make the labeled dataset trustworthy before adding more chart features.

Working principle:

1. Freeze the export contract.
2. Add versioning and leakage guards.
3. Add linkage and intent fields.
4. Add multi-timeframe and paired context.
5. Add validation and export health reporting.
6. Then simplify the UI for faster labeling.

## Project Reconciliation

Accepted:

- Visual chart review plus structured labels is the right product shape.
- Dataset trust is now higher priority than more charting features.
- Label rows need versioning, leakage metadata, explicit intent, and linkage fields.
- One exported row should represent one decision label.
- Multi-timeframe fields should be prefixed, not exported as separate rows.
- Future/outcome fields must be namespaced and excluded from default training-feature exports.
- Grid mode should become a scanner; focused mode should be the primary labeling surface.
- Regular-mode labels should carry a leakage-warning flag.

Adjusted:

- Do not add every suggested field at once. Add schema support and validation in small slices, then widen features.
- Do not build full setup/trade lifecycle UI immediately. First persist the linkage fields with useful defaults and optional editing.
- Keep raw notes in JSON exports. CSV should include `notes_present` and `notes_length`, not full notes by default.
- Keep drawing geometry nested. CSV should flatten only distance, side, visibility, and count fields.

Rejected for now:

- Strategy mining.
- Backtesting.
- Broker execution.
- Cloud sync.
- More drawing tools.
- More indicators.
- Broad ticker scanning.
- Parameter optimization.

## Implementation Sequence

### Slice 68: Export Contract And Version Manifest

Status: Done.

Goal: create a stable export contract before widening data.

Build:

- Add central constants for:
  - `schemaVersion`
  - `exportVersion`
  - `indicatorCalcVersion`
  - `structureCalcVersion`
- Add an export manifest object to JSON export responses or a sibling manifest endpoint/file shape.
- Include export metadata in CSV as stable columns:
  - `schema_version`
  - `export_version`
  - `indicator_calc_version`
  - `structure_calc_version`
- Add tests proving these fields are present in JSON and CSV exports.

Boundary:

- Do not change the capture UI in this slice.
- Do not add outcome fields yet.

Validation:

```bash
pnpm --filter @edgelord/api test -- tests/exportRoutes.test.ts tests/labelService.test.ts
pnpm verify
```

### Slice 69: Label Leakage Metadata

Status: Done.

Goal: every decision label declares what market data was visible when it was created.

Build:

- Add persistent/defaulted label fields:
  - `decisionPhase`: default `at_close`
  - `captureMode`: `replay` or `regular`
  - `visibleUntilTimestamp`
  - `potentialVisualLeakage`
  - `selectedBarIndex`
- At capture time:
  - set `visibleUntilTimestamp` to selected candle timestamp by default for `at_close`
  - set `potentialVisualLeakage = true` for regular-mode labels
- Export these fields in CSV/JSON.
- Add tests for replay and regular-mode labels.

Boundary:

- Do not block regular-mode labels yet; flag them.

Validation:

```bash
pnpm test:focused-ui
pnpm verify
```

### Slice 70: Linkage And Intent Fields

Status: Done.

Goal: make labels useful as setup/trade examples instead of loose annotations.

Build:

- Add optional persistent fields:
  - `setupId`
  - `tradeId`
  - `parentLabelId`
  - `decisionRole`
  - `bias`
  - `marketBias`
  - `tradeDirection`
  - `instrumentRole`
  - `pairedTickerRole`
  - `entryStyle`
  - `exitStyle`
  - `invalidationPrice`
  - `targetPrice`
- Use conservative defaults:
  - `decisionRole`: derived from label type when absent
  - `bias`: `unclear`
  - `marketBias`: `unclear`
  - `tradeDirection`: `observe_only` unless explicitly selected
  - `instrumentRole`: `primary`
  - `pairedTickerRole`: `ignored`
- Add compact editor controls only where needed; do not overbuild lifecycle UI.
- Export the fields.

Boundary:

- No setup/trade dashboard yet.
- No automatic pairing inference.

Validation:

```bash
pnpm --filter @edgelord/web test -- src/components/CapturePanel.test.tsx
pnpm verify
```

### Slice 71: Multi-Timeframe Context Snapshot

Status: Done.

Goal: capture daily, 4H, and 2H context in the same decision row without future leakage.

Build:

- At label time, build `multiTimeframeContext` for the selected ticker:
  - `d1`
  - `h4`
  - `h2`
- For each timeframe, choose the last fully closed candle at or before `visibleUntilTimestamp`.
- Store context age in minutes:
  - `d1_context_age_minutes`
  - `h4_context_age_minutes`
  - `h2_context_age_minutes`
- Include raw nested context in JSON.
- Flatten core prefixed fields in CSV:
  - timestamp
  - close
  - EMA/SMA/VWAP state
  - SMIO/Stoch RSI/CM WVF/ATR summary
  - recent 20 high/low distance fields

Boundary:

- Do not create separate export rows per timeframe.

Validation:

```bash
pnpm --filter @edgelord/web test -- src/store/useAppStore.test.ts
pnpm --filter @edgelord/api test -- tests/exportRoutes.test.ts
pnpm verify
```

### Slice 72: Derived Decision Feature Columns

Status: Done.

Goal: convert visual candle/indicator structure into model-friendly features.

Build:

- Add flattened selected-candle features:
  - range
  - body
  - upper/lower wick
  - close position in range
  - one-bar return
  - gap from previous close
  - ATR-normalized range
- Add trend/location flags:
  - close above EMA/SMA/VWAP
  - distance to EMA/SMA/VWAP in percent and ATR units
- Add indicator state flags:
  - Stoch RSI K above D
  - overbought/oversold
  - SMIO histogram/slope
  - CM WVF signal/spike state
  - ATR percent of close
- Add recent structure features:
  - bars since recent high/low
  - recent 5/10/20 returns
  - recent range in ATR
  - close rank in recent 20 range

Boundary:

- These are decision features only. No future outcomes.

Validation:

```bash
pnpm --filter @edgelord/api test -- tests/exportRoutes.test.ts
pnpm verify
```

### Slice 73: Paired ETF And Ratio Features

Status: Done.

Goal: make SOXL/SOXS context explicit rather than inferred from ticker names.

Build:

- Flatten paired ETF features:
  - aligned OHLCV
  - same selected indicator summary
  - paired trend/location flags
- Add ratio features:
  - `pair_ratio_close`
  - `pair_ratio_return_1`
  - `pair_ratio_return_5`
  - `pair_ratio_return_10`
  - `pair_ratio_above_sma_20`
  - `pair_ratio_sma_20_distance_pct`
  - `pair_divergence_flag`
- Add missing-paired-context flags.

Boundary:

- Do not infer trade bias from SOXL/SOXS automatically.

Validation:

```bash
pnpm --filter @edgelord/api test -- tests/exportRoutes.test.ts
pnpm smoke:ui
pnpm verify
```

### Slice 74: Export Validation Report

Status: Done.

Goal: make export trust visible and testable.

Build:

- Add validation service and route for current export scope.
- Checks:
  - label ID uniqueness
  - selected candle exists
  - selected timestamp matches ticker/timeframe
  - selected timestamp <= `visibleUntilTimestamp`
  - paired context exists or is explicitly missing
  - multi-timeframe context timestamps <= `visibleUntilTimestamp`
  - higher timeframe context is fully closed
  - indicator/structure snapshots exist
  - drawing references resolve
  - drawing existed before or at label time where available
  - label type/confidence/setup quality/reason codes are valid
  - ENTRY labels missing intent are warned
  - EXIT labels without linkage are warned
  - regular-mode labels are warned
  - CSV row count equals label count after filters
- Return summary counts and issue list.
- Add compact UI status in export/session area later; API first.

Boundary:

- Validation warns; it should not block export yet.

Validation:

```bash
pnpm --filter @edgelord/api test -- tests/exportRoutes.test.ts tests/reviewRoutes.test.ts
pnpm verify
```

### Slice 75: Dataset Health Summary UI

Status: Done.

Goal: make data quality visible inside the workstation.

Build:

- Add compact health summary in the right secondary review panel:
  - labels by ticker
  - labels by timeframe
  - labels by label type
  - labels by replay/regular mode
  - missing paired context count
  - leakage warning count
  - incomplete intent count
- Add export validation status near export controls.

Boundary:

- Keep it compact. Do not build analytics or strategy mining.

Validation:

```bash
pnpm test:focused-ui
pnpm smoke:ui
pnpm verify
```

### Slice 76: Grid Scanner Simplification

Status: Done.

Goal: make grid mode useful for context without overloading labeling.

Build:

- In grid mode, collapse detailed indicator panes by default.
- Show compact indicator badges/state strips instead.
- Keep full indicator panes in focused mode.
- Preserve hover crosshair/readouts.

Boundary:

- No new indicators.

Validation:

```bash
pnpm test:focused-ui
pnpm smoke:ui
pnpm workflow:focused-ui -- --verify
```

### Slice 77: Capture Panel Empty-State Utility

Status: Done.

Goal: the capture panel should help even when no candle is selected.

Build:

- Show current target ticker/timeframe.
- Show hotkeys.
- Show active session label count.
- Show last labeled candle.
- Add undo/delete last label if it maps safely to existing delete behavior.
- Keep compact label history visible.

Boundary:

- Undo should be limited to last label delete, not arbitrary history rollback.

Validation:

```bash
pnpm --filter @edgelord/web test -- src/components/CapturePanel.test.tsx
pnpm workflow:focused-ui -- --verify
```

### Slice 78: Toolbar Zone Cleanup

Status: Done.

Goal: make the top toolbar feel less prototype-like.

Build:

- Group controls into:
  - Market
  - Replay
  - Nav
  - Session
  - Export
- De-emphasize CSV/JSON during labeling.
- Keep keyboard/replay actions reachable.

Boundary:

- No new toolbar features.

Validation:

```bash
pnpm --filter @edgelord/web test -- src/components/ReplayToolbar.test.tsx
pnpm workflow:focused-ui -- --verify
```

### Slice 79: Narrow Compact Label Bar

Status: Done.

Goal: narrow layout should preserve chart review space.

Build:

- Replace bulky lower capture state with a compact sticky label bar:
  - Entry
  - Exit
  - Skip
  - Invalid
  - Confidence
  - Setup Quality
  - Details
- Expand details only when needed.
- Preserve existing hotkeys.

Boundary:

- Browser narrow fallback only; do not redesign desktop.

Validation:

```bash
pnpm smoke:ui
pnpm workflow:focused-ui -- --verify
```

### Slice 80: Setup/Trade Lifecycle Foundation

Status: Done.

Goal: turn loose candle events into linked setup/trade examples without starting strategy mining.

Build:

- Add minimal persistence/export fields:
  - `setupId`
  - `tradeId`
  - `parentLabelId`
  - `decisionRole`
  - `bias`
  - `tradeDirection`
- Keep labels one row per decision.
- Add compact capture defaults and validation for the new fields.

Boundary:

- No outcome evaluator.
- No rule explorer.
- No backtesting engine.

Validation:

```bash
pnpm verify
```

### Slice 81: Lifecycle Review Summary

Status: Done.

Goal: make lifecycle metadata auditable during labeling without building a strategy-mining workspace.

Build:

- Add review/export health counts for:
  - labels by decision role
  - labels by bias
  - labels by trade direction
  - labels with setup IDs
  - labels with trade IDs
- Show the counts compactly in the review panel validation area.
- Keep one label as one export row.

Boundary:

- No outcome evaluator.
- No backtesting engine.
- No rule explorer.

Validation:

```bash
pnpm verify
```

### Slice 82: Setup/Trade Lifecycle Workspace

Status: Done.

Goal: make setup/trade grouping fast enough to use while labeling.

Build:

- Add compact controls to start or continue a setup/trade idea.
- Let labels assign or reuse setup/trade IDs without typing every time.
- Keep lifecycle roles explicit:
  - setup start
  - trigger
  - entry
  - management
  - exit
  - skip
  - invalid
- Preserve one label as one export row.

Boundary:

- No outcome evaluator.
- No rule explorer.
- No backtesting engine.

Validation:

```bash
pnpm workflow:focused-ui -- --verify
```

### Slice 83: Outcome Evaluator Foundation

Status: Done.

Goal: prepare evaluation fields without mixing future outcomes into training features.

Build:

- Add namespaced optional outcome fields for future return, MFE, MAE, target hit, stop hit, and bars-to-hit.
- Keep outcome fields excluded from the main decision feature export by default.
- Add manifest/validation language that outcome fields are evaluation-only.

Boundary:

- No backtesting engine.
- No rule explorer.
- No parameter optimization.

Validation:

```bash
pnpm --filter @edgelord/api test -- tests/schema.test.ts tests/labelService.test.ts tests/exportRoutes.test.ts
pnpm --filter @edgelord/web typecheck
pnpm workflow:focused-ui -- --verify
```

### Slice 84: Outcome QA Review Surface

Status: Done.

Goal: make outcome coverage visible without starting backtesting or rule mining.

Build:

- Add review/export health copy for outcome coverage.
- Show `labelsWithOutcomeAvailable`.
- Show that outcome fields are excluded from the decision CSV by default.
- Keep the surface informational only.

Boundary:

- No outcome computation.
- No rule explorer.
- No backtesting engine.

Validation:

```bash
pnpm workflow:focused-ui -- --verify
```

### Slice 85: Outcome Calculation Service

Status: Done.

Goal: compute outcome fields deterministically while keeping them evaluation-only.

Build:

- Add a backend service that calculates outcomes for a label from future candles on the same ticker/timeframe.
- Compute future return horizons, MFE, MAE, target hit, stop hit, and bars-to-hit.
- Persist results into the existing `outcome_*` label fields.
- Keep outcome fields out of decision CSV by default.

Boundary:

- No strategy mining.
- No rule explorer.
- No walk-forward backtest harness.
- No optimizer.

Validation:

```bash
pnpm --filter @edgelord/api test -- tests/outcomeService.test.ts tests/exportRoutes.test.ts
pnpm workflow:focused-ui -- --verify
```

### Slice 86: Outcome Calculation UI Action

Status: Done.

Goal: make deterministic outcome enrichment usable without introducing backtesting.

Build:

- Add a compact UI action for calculating outcomes on the selected or last label.
- Show success/failure status in the existing capture/review status surfaces.
- Refresh review and export validation after calculation.
- Keep the action label-level and explicit.

Boundary:

- No bulk backtest.
- No rule explorer.
- No optimizer.

Validation:

```bash
pnpm --filter @edgelord/web test -- src/store/useAppStore.test.ts src/components/CapturePanel.test.tsx
pnpm workflow:focused-ui -- --verify
```

Product-pass hardening:

- Browser smoke covers label creation, edit, outcome calculation, JSON export, and delete.
- JSON export smoke asserts evaluation-only outcome fields round-trip after calculation.

### Slice 87: Label QA Review Mode

Status: Done.

Goal: make export validation issues reviewable before rule discovery or backtesting.

Build:

- Add compact Label QA section in the review panel.
- Add filters for all, errors, warnings, leakage, intent, and outcome issues.
- Show severity, issue code, and label context.
- Let a QA issue jump back to the affected label when label context exists.
- Extend browser smoke to check Label QA and warning filtering.

Boundary:

- No rule explorer.
- No backtest harness.
- No bulk label editor.

Validation:

```bash
pnpm --filter @edgelord/web test -- src/components/ReviewPanel.test.tsx
API_PORT=4318 WEB_PORT=5174 pnpm smoke:ui
pnpm workflow:focused-ui -- --verify
```

### Slice 88: Session Gating UX

Status: Done.

Goal: make it obvious why labels are disabled when no active session exists.

Build:

- Show `Start or resume a session to label candles` in capture when session state blocks labeling.
- Add a capture-local `Start Session` shortcut.
- Keep chart/candle inspection available while preventing ambiguous sessionless labels.
- Add focused tests for the gated state and quick session start.

Validation:

```bash
pnpm --filter @edgelord/web test -- src/components/CapturePanel.test.tsx
pnpm workflow:focused-ui -- --verify
```

### Slice 89: Review Panel Reachability

Status: Done.

Goal: make QA and review reachable during active labeling instead of buried below capture detail/editor content.

Build:

- Add compact capture review summary for label count, warnings, and intent gaps.
- Collapse capture details after create/save.
- Auto-open review when export validation issues exist.
- Fix narrow dock stacking so the Session row stays clickable when Review is open.
- Update smoke coverage for state-aware Review checks.

Validation:

```bash
pnpm --filter @edgelord/web test -- src/components/CapturePanel.test.tsx src/components/ReviewPanel.test.tsx
API_PORT=4318 WEB_PORT=5174 pnpm smoke:ui
pnpm workflow:focused-ui -- --verify
```

### Slice 90: Replay Date Input Cleanup

Status: Done.

Goal: make replay start boundaries explicit and predictable.

Build:

- Accept `YYYY-MM-DD` and `MM/DD/YYYY` replay date entry.
- Normalize valid slash dates into the canonical replay boundary.
- Show inline validation for malformed dates.
- Show an explicit no-candle warning for dates after the loaded dataset instead of silently jumping to the last candle.
- Rename replay state copy to `Regular: all bars` and `Replay: future hidden`.
- Show the active replay boundary in the toolbar.

Validation:

```bash
pnpm --filter @edgelord/web test -- src/components/ReplayToolbar.test.tsx src/store/useAppStore.test.ts
pnpm --filter @edgelord/web typecheck
```

### Slice 91: Data Quality / Adjustment Warning

Status: Done.

Goal: catch suspicious adjusted/split/import discontinuities before labels and exports are trusted.

Build:

- Add an aggregated-bar discontinuity detector for large close-to-close moves and open gaps.
- Return data-quality warnings from synchronized chart responses.
- Add dataset-level export validation warnings with no label binding.
- Surface loaded chart warnings in the toolbar.
- Cover the SOXS 2H March-style discontinuity path in API and web tests.

Validation:

```bash
pnpm --filter @edgelord/api test -- apps/api/tests/chartRoutes.test.ts apps/api/tests/exportRoutes.test.ts
pnpm --filter @edgelord/web test -- src/components/ReplayToolbar.test.tsx src/store/useAppStore.test.ts src/components/CapturePanel.test.tsx src/charts/ChartGrid4H.test.tsx
pnpm --filter @edgelord/api typecheck && pnpm --filter @edgelord/web typecheck
```

### Slice 92: Drawing Tool Feedback

Status: Done.

Goal: make drawing tools self-explanatory and visibly stateful without adding new drawing features.

Build:

- Add drawing status feedback for active tools, first anchors, completed drawings, selection, updates, and deletion.
- Keep chart-click selection from canceling an active drawing tool.
- Focus the chart ticker/timeframe when an existing drawing is selected.
- Make the delete action describe the selected drawing instead of a generic disabled affordance.
- Strengthen selected drawing glow while keeping the chart surface compact.

Validation:

```bash
pnpm --filter @edgelord/web test -- src/components/ToolRail.test.tsx src/charts/ChartGrid4H.test.tsx src/store/useAppStore.test.ts
pnpm --filter @edgelord/web typecheck
```

### Slice 93: Research Readiness Gate

Status: Done.

Goal: prevent premature rule discovery/backtesting by making dataset readiness visible.

Build:

- Add a read-only readiness summary in the Review panel.
- Gate readiness on minimum label count, entry count, exit count, setup linkage, outcome coverage, and validation errors.
- Show compact counts for labels, replay labels, entries, exits, and outcomes.
- Show the first blocking `Next Gate` item.

Validation:

```bash
pnpm --filter @edgelord/web test -- src/components/ReviewPanel.test.tsx
pnpm --filter @edgelord/web typecheck
```

## Deferred Until After Dataset Trust Sequence

- Rule candidate explorer.
- Walk-forward backtest harness.
- Additional drawing tools.
- Additional indicators.
- Broker/account integration.
- Cloud sync.

## Current Accepted Next Slice

No automatic next slice.

Reason: the consultant-reconciled dataset-trust sequence is complete through label-level outcome calculation, and v2 QA review/replay/data-quality/drawing feedback/research-readiness cleanup is now usable enough to continue collecting and reviewing labels before rule discovery or backtesting.
