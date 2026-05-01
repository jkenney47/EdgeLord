# EdgeLord Current Handoff

## Canonical Project Directory

Use this directory:

```bash
/Users/JoeyKenney/Documents/EdgeLord
```

Do not recreate `/Users/JoeyKenney/Documents/New project`; the project has been consolidated into the single folder `/Users/JoeyKenney/Documents/EdgeLord`.

## Current Product Direction

EdgeLord is a local-first, desktop-first web app: a TradingView-style replay workstation with decision capture on top. The app should feel like a fast charting surface first, not a dashboard, and definitely not a mobile app. The core job is to capture discretionary trading decisions as structured data for later strategy extraction and backtesting.

Authoritative plan:

- `docs/CHATGPT_PRO_DEVELOPMENT_PLAN.md`
- `docs/TRADINGVIEW_WORKSTATION_PLAN.md`
- `docs/CONSULTANT_IMPLEMENTATION_PLAN.md`

The plan is current through **Slice 122: Toolbar Primary/Secondary Split**. The next recommended step is another in-app browser pass over the simplified default loop, focused on any remaining visible friction after the toolbar hierarchy and candle-selection repairs. Do not use standalone Playwright for EdgeLord UI verification; use the Codex in-app browser when browser control is available.

## Current Implementation State

Implemented:

- React/Vite web app plus Fastify API.
- Local SQLite-backed sessions, drawings, labels, review summaries, and exports.
- Alpaca market-data import path.
- Data coverage endpoint and toolbar coverage/gap readout.
- User-selectable import `startDate`, `endDate`, and base timeframe controls.
- Source-timeframe-aware aggregation for `1Min` and `5Min` imports.
- Alpaca imports default to adjusted bars (`adjustment=all`) so splits/dividends are handled at the provider boundary.
- Successful imports now replace stale aggregate rows inside the requested ticker/date range before writing refreshed aggregates.
- Data-quality discontinuities are classified as review-only volatility/session gaps or actual bad-source warnings.
- Toolbar distinguishes `Data review N` from `Data warnings N`.
- Review panel now explains the toolbar `Data review N` count by classification.
- Label QA issue rows now distinguish dataset/global issues and missing label lookups instead of using the vague `No label context` copy.
- Toolbar coverage status now shows an explicit loading state while chart data is in flight, instead of temporarily saying no coverage is loaded.
- Capture now stays ready for the next label after saving; saved labels open the editor only when selected from history/review.
- Selected candles now have an explicit active/related chart marker contract plus a Capture-panel selected-candle card with ticker, timeframe, timestamp, provenance, and bar index.
- Open sessions are remembered locally and auto-resumed on reload; first label capture can start a Quick capture session without a blocking pre-step.
- Capture now exposes `U` / `Undo Last` for fast correction of the most recent label.
- Capture now owns the primary right-rail surface; Dataset Trust is compact in Capture and the full Review drawer stays collapsed until explicitly opened.
- Post-create label behavior is mode-aware: regular review stays on the selected candle, while replay mode advances to the next candle after saving and preserves the created-label confirmation.
- Label pins now have compact normal, selected, QA warning, QA blocker, and same-candle cluster states. Cluster clicks focus the first label and expand the cluster into individual pins.
- Chart navigation now includes keyboard label navigation, keyboard QA-issue navigation, double-click fit/reset, and wheel zoom while keeping cursor-mode drag passive.
- Review QA rows now load label context for all-label validation reports, so label-specific warnings are focusable instead of showing missing context.
- Dataset Trust now has an actionable QA issue queue with blocker/warning/info totals, suggested fixes, label jump behavior, and selectable dataset/global rows.
- Replay-safe vs future-visible provenance is visible in Capture label history and Review replay-clean coverage, so regular-mode labels stay allowed but are not implied to be simulation-safe.
- Capture Details now includes a trade linkage editor for entry trades, attaching exits, invalidating setups, and keeping skips unlinked, plus compact trade lifecycle cards.
- Data import controls now show scoped import success/failure status and clear stale import status when import inputs change.
- Export controls now show scope plus label count, and disabled export controls are non-navigable.
- Data import, Replay setup, and Export now live behind compact toolbar utility drawers so Market, mode switching, candle navigation, and session status remain the primary topbar controls.
- Saved-label editing now opens Details automatically, so intent/linkage QA warnings expose the fields needed to fix them.
- Edit mode now includes a compact QA repair strip for incomplete entry intent and exit linkage warnings.
- SOXL/SOXS synchronized chart data for `1D`, `4H`, and `2H`.
- Multi-timeframe desktop grid: SOXL/SOXS rows by `1D`, `4H`, `2H` columns.
- Focused chart mode: expand the active ticker/timeframe panel, then restore grid.
- Replay/regular modes:
  - replay hides future candles
  - regular shows all data
  - labels are allowed in either mode
- TradingView-style chart shell:
  - compact top toolbar
  - left drawing rail
  - right capture/secondary panel stack
  - responsive browser fallback for narrow windows
- Drawing tools:
  - trendline with draggable endpoints
  - horizontal level
  - breakout marker
- Decision capture:
  - `ENTRY`, `EXIT`, `SKIP`, `INVALID`
  - keyboard shortcuts `E`, `X`, `S`, `I`
  - editable labels
  - freeform reasons/notes are optional
- Indicator panes:
  - SMIO `20 20 10`
  - Stoch RSI `7 10 14 15`
  - CM WVF locked to `22 20 2 50 0.85 40 14 3`
  - ATR `14 RMA`
- Export:
  - JSON full export
  - flattened CSV export
  - toolbar export controls
- toolbar zones for Market, Replay, Nav, Session, and compact Data/Replay setup/Export utilities
  - compact sticky narrow label bar
  - setup/trade lifecycle metadata capture and export validation
  - lifecycle coverage QA counts in review/export health
  - compact lifecycle workspace controls in capture Details
  - evaluation-only outcome fields in label persistence and JSON export metadata
  - explicit outcome status and rule-version fields in label persistence, JSON export metadata, and review/export health
  - outcome coverage QA counts in review/export health
  - export preview/manifest status in the toolbar, including row count, schema, QA blockers/warnings, label types, and outcome inclusion
  - backend outcome calculation service and label outcome route
  - label-level outcome calculation action in the capture panel

## Recent Completed Slices

### Slice 90: Replay Date Input Cleanup

Added:

- Replay start input now accepts `YYYY-MM-DD` and `MM/DD/YYYY`.
- Valid slash dates are normalized into the canonical replay boundary.
- Invalid dates show inline feedback and do not move the replay cursor.
- Dates after the available dataset show an explicit no-candle warning instead of silently jumping to the final candle.
- Replay mode copy now distinguishes `Regular: all bars` from `Replay: future hidden`.
- Toolbar shows the active replay boundary date in a dedicated status pill.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/ReplayToolbar.test.tsx src/store/useAppStore.test.ts
pnpm --filter @edgelord/web typecheck
```

### Slice 91: Data Quality / Adjustment Warning

Added:

- Shared aggregated-bar discontinuity detector for suspicious open gaps and close-to-close jumps.
- `/chart/sync` responses now include chart data-quality warnings for the requested ticker/timeframe set.
- Export validation now emits dataset-level `data_quality_large_price_discontinuity` warnings with `labelId: null`.
- Toolbar session status shows a compact `Data warnings N` badge when loaded chart data has warnings.
- Focused tests cover SOXS 2H discontinuity detection in chart sync, export validation, and the toolbar badge.

Verified:

```bash
pnpm --filter @edgelord/api test -- apps/api/tests/chartRoutes.test.ts apps/api/tests/exportRoutes.test.ts
pnpm --filter @edgelord/web test -- src/components/ReplayToolbar.test.tsx src/store/useAppStore.test.ts src/components/CapturePanel.test.tsx src/charts/ChartGrid4H.test.tsx
pnpm --filter @edgelord/api typecheck && pnpm --filter @edgelord/web typecheck
```

### Slice 92: Drawing Tool Feedback

Added:

- Drawing status feedback for active tools, first anchors, completed drawings, selection, updates, and deletion.
- Chart-click selection no longer cancels an active drawing tool before creation.
- Selecting a drawing focuses its ticker/timeframe.
- Delete affordance now describes the selected drawing.
- Selected drawing glow is stronger while keeping the chart surface compact.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/ToolRail.test.tsx src/charts/ChartGrid4H.test.tsx src/store/useAppStore.test.ts
pnpm --filter @edgelord/web typecheck
pnpm workflow:focused-ui -- --verify
```

### Browser Review Pass After Slice 92

Checked in the in-app browser at `http://127.0.0.1:5173/`:

- App shell, drawing tools, replay controls, capture panel, and review panel load.
- Replay date after the dataset shows the no-candle warning.
- Drawing line tool shows active instructions and resets to `Cursor ready`.
- Review warning filter is reachable and shows warning issues.

Finding:

- No blocking UI regression found in the reviewed paths.
- Planning/tooling continuity needed cleanup because the focused workflow printed `Next: Unknown next slice`; the workflow now falls back to the first suggested-scope bullet.

### Slice 93: Research Readiness Gate

Added:

- Read-only research readiness summary in the Review panel.
- Readiness status intentionally blocks premature rule discovery/backtesting when sample size, entries, exits, setup IDs, outcomes, or validation errors are insufficient.
- Compact counts for labels, replay labels, entries, exits, and outcome rows.
- Explicit `Next Gate` copy showing the first concrete blocker.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/ReviewPanel.test.tsx
pnpm --filter @edgelord/web typecheck
```

In-app browser check:

- `RESEARCH READINESS` appears in the Review panel.
- Current dataset shows `Not ready`, which is correct for the small current label set.

### Slice 94: Data Coverage + Import Range Controls

Added:

- `/chart/coverage` returns per-ticker/timeframe bar counts, first/latest timestamps, and large timestamp gaps.
- Toolbar Data zone now exposes import start date, end date, and base timeframe (`1Min`/`5Min`) instead of hard-coding a rolling one-year import.
- Chart loading and import refresh the data coverage report.
- Toolbar shows compact coverage date range and coverage gap count so missing history is visible before labeling or research review.

Verified:

```bash
pnpm --filter @edgelord/api test -- apps/api/tests/chartRoutes.test.ts
pnpm --filter @edgelord/web test -- src/store/useAppStore.test.ts src/components/ReplayToolbar.test.tsx
```

### Slice 95: Coverage Backfill + Source-Timeframe Aggregation

Added:

- Aggregation now accepts sparse-but-sufficient source buckets instead of requiring exact per-minute completeness.
- Aggregation is source-timeframe aware, so `5Min` imports produce minute-equivalent `sourceBarCount` values and valid `1D`, `4H`, and `2H` bars.
- UI import defaults to `5Min`, which produced cleaner Alpaca IEX historical coverage for SOXL/SOXS than `1Min`.

Data backfill:

- Ran `2024-01-01` through `2026-04-28` imports for `1Min` and then `5Min`.
- Current coverage is now gap-free by the app's large-gap detector:
  - SOXL `1D`: 573 bars, `2024-01-02` to `2026-04-27`
  - SOXL `4H`: 579 bars, `2024-01-02` to `2026-04-27`
  - SOXL `2H`: 1726 bars, `2024-01-02` to `2026-04-27`
  - SOXS `1D`: 561 bars, `2024-01-02` to `2026-04-27`
  - SOXS `4H`: 567 bars, `2024-01-02` to `2026-04-27`
  - SOXS `2H`: 1669 bars, `2024-01-02` to `2026-04-27`

Verified:

```bash
pnpm --filter @edgelord/api test -- apps/api/tests/aggregateBars.test.ts apps/api/tests/importService.test.ts apps/api/tests/chartRoutes.test.ts
```

### Slice 96: Adjusted Import + Aggregate Cache Rebuild Guard

Added:

- Alpaca provider requests now default to `adjustment=all`, replacing the previous raw-bar import behavior.
- Import service collects provider data before mutating aggregate cache rows, so provider failures do not wipe existing chart aggregates.
- Successful imports delete stale `aggregated_bars` rows for the requested tickers, supported chart timeframes, and import date range before inserting refreshed aggregates.
- Regression coverage verifies that an old split-artifact aggregate bucket is removed when a refreshed import omits that bucket.

Verified:

```bash
pnpm --filter @edgelord/api test -- apps/api/tests/importService.test.ts apps/api/tests/marketDataTypes.test.ts apps/api/tests/chartRoutes.test.ts
```

Live-cache rebuild:

- Re-ran the adjusted `5Min` import for SOXL/SOXS from `2024-01-01` through `2026-04-28`.
- Import result: `102325` base bars refreshed, `5652` aggregate bars rebuilt, and no import warnings returned.
- Confirmed stale SOXS `2H` split-artifact rows around `2025-11-28` were replaced with adjusted values.
- API/browser result after rebuild:
  - `Coverage gaps 0`
  - browser toolbar range `2024-01-02 to 2026-04-27`
  - `Data warnings 11`, down from the stale-cache count of `17`

### Slice 97: Data Warning Classification

Added:

- Data-quality warnings now include:
  - `severity`: `review` or `warning`
  - `classification`: `leveraged_etf_volatility`, `session_gap`, or `possible_bad_source_data`
- SOXL/SOXS large moves below hard bad-source thresholds are classified as review-only leveraged ETF volatility instead of automatic bad-data warnings.
- Large open gaps without a large close-to-close move are classified as review-only session gaps.
- Extreme non-leveraged or implausible discontinuities remain real data warnings.
- Export validation only promotes `severity: warning` data-quality events into export validation warnings.
- Toolbar counts warning severity separately from review severity:
  - real bad-source events show `Data warnings N`
  - review-only events show `Data review N`

Verified:

```bash
pnpm --filter @edgelord/api test -- apps/api/tests/exportRoutes.test.ts apps/api/tests/chartRoutes.test.ts
pnpm --filter @edgelord/web test -- src/components/ReplayToolbar.test.tsx
pnpm workflow:focused-ui -- --verify
```

In-app browser check:

- `Coverage gaps 0`
- toolbar data range `2024-01-02 TO 2026-04-27`
- `DATA REVIEW 11`
- no `DATA WARNINGS` badge for the current SOXL/SOXS adjusted dataset

### Slice 98: Review Data-Quality Classification Surfacing

Added:

- Review panel now shows a compact `Data Review` classification summary inside Dataset Health.
- The current adjusted SOXL/SOXS dataset shows:
  - `DATA REVIEW 11` in the toolbar
  - `DATA REVIEW 11` in Review
  - `SESSION GAP 6`
  - `LEVERAGED ETF VOLATILITY 5`
- These review-only items remain separate from export validation warning counts, so they provide context without making legitimate SOXL/SOXS volatility look like bad source data.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/ReviewPanel.test.tsx
pnpm workflow:focused-ui -- --verify
```

In-app browser check:

- Loaded charts from `http://127.0.0.1:5173/`.
- Toolbar showed `COVERAGE GAPS 0` and `DATA REVIEW 11`.
- Review panel showed `DATA REVIEW 11`, `SESSION GAP 6`, and `LEVERAGED ETF VOLATILITY 5`.

### Slice 99: Global QA Issue Context

Added:

- Label QA rows now show `Dataset issue` when an export validation issue has no `labelId`.
- Label QA rows now show `Missing label context` when an issue references a label that is not currently available in the loaded label list.
- Label-specific QA rows still show the concrete label summary and keep the focus-label behavior.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/ReviewPanel.test.tsx
pnpm workflow:focused-ui -- --verify
```

In-app browser check:

- Reloaded `http://127.0.0.1:5173/` and loaded charts.
- Review panel no longer contains `No label context`.
- Current all-label QA rows show `Missing label context` for issue rows whose labels are not loaded into the current panel context.

### Slice 100: Coverage Loading State Clarity

Added:

- Toolbar coverage status now returns `Loading coverage` while chart data is loading and no coverage report is available yet.
- This avoids the contradictory state where the primary action said `Loading` but the Data zone said `No coverage loaded`.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/ReplayToolbar.test.tsx
pnpm workflow:focused-ui -- --verify
```

In-app browser check:

- Reloaded `http://127.0.0.1:5173/` and clicked `Load Charts`.
- During the request, toolbar showed `LOADING COVERAGE` and did not show `NO COVERAGE LOADED`.
- After loading completed, toolbar returned to `2024-01-02 TO 2026-04-27` with `DATA REVIEW 11`.

### Slice 101: Fast Capture Loop

Added:

- Creating a label no longer auto-opens edit mode.
- The saved-label status still shows the created label details.
- Label editing remains available by selecting a saved label from history/review.

Why:

- In the live in-app browser QA flow, label creation worked but immediately blocked the next label with `Finish editing the saved label before capturing another.`
- That is too slow for high-volume chart labeling; editing should be explicit, not automatic.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/CapturePanel.test.tsx src/store/useAppStore.test.ts
```

In-app browser check:

- Selected a chart candle, started a quick capture session, and created an `ENTRY` label.
- After save, Capture showed `Created label` and `ENTRY SOXL ... 4H`.
- `Entry` stayed enabled.
- No `EDIT LABEL` panel appeared.
- No `Finish editing...` blocker appeared.

### Slice 102: Review QA Label Context

Added:

- `GET /labels` now supports all-label listing when `sessionId` is omitted.
- Web `listTradeEvents` now accepts an optional session id.
- Review summary loading now refreshes matching label context together with review/export validation data.
- All-label QA rows can show concrete label context and focus the label instead of falling back to missing context.

Why:

- In the in-app browser Review pass, export validation issues had label ids but the panel did not always have the matching labels loaded.
- That made label-specific QA rows look like dead rows even though the validation report was correct.

Verified:

```bash
pnpm --filter @edgelord/api test -- apps/api/tests/labelRoutes.test.ts
pnpm --filter @edgelord/web test -- src/components/ReviewPanel.test.tsx src/store/useAppStore.test.ts
```

In-app browser check:

- Loaded charts, created a quick local `ENTRY` label, and opened Review warnings.
- QA rows showed concrete context such as `ENTRY SOXL 4H 2025-10-31`.
- QA row buttons were enabled.
- Review no longer showed `Missing label context` for the tested label-specific warning rows.

### Slice 103: Import Status + Drawing QA

Added:

- Toolbar Data controls now show scoped import status:
  - `Importing data`
  - `Imported X source / Y chart bars`
  - `Import failed: ...`
- Import start/end/timeframe changes clear stale import success/failure status.
- Failed imports clear stale `lastImportResult`, so old success does not remain visible after a failure.

Browser QA:

- Verified local invalid import request shows `IMPORT FAILED: IMPORT REQUEST FAILED: 400` inside Data controls.
- Verified correcting the import start date clears the stale import failure and top error banner.
- Verified horizontal level tool enters drawing mode, creates a `SOXL 4H horizontal level`, and selects it.
- Did not delete the test drawing because local deletion requires explicit action-time confirmation.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/ReplayToolbar.test.tsx src/store/useAppStore.test.ts
```

### Slice 104: Export Scope + Replay QA

Added:

- Toolbar export controls now show explicit scope and count, for example `All 11 labels` or `Session 1 label`.
- Export CSV/JSON links remain real links only when exportable labels exist.
- Disabled export controls stay visible with `aria-disabled="true"` but no `href`, so they cannot accidentally navigate.

Browser QA:

- In the in-app browser at `http://127.0.0.1:5173/`, verified the export zone shows `All 11 labels`.
- Verified enabled CSV/JSON links point to the all-label export endpoints.
- Verified replay mode accepts `2025-10-01`, then `Next` moves to `2025-10-02`, and `Prev` returns to `2025-10-01`.
- Verified replay counts moved `425 / 565` -> `426 / 565` -> `425 / 565`.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/ReplayToolbar.test.tsx
```

### Slice 105: Review QA Edit Details

Added:

- Opening a saved label for editing now automatically expands Details.
- This exposes setup/trade IDs, parent label, decision role, bias, direction, reasons, and notes immediately.
- Review QA rows such as `entry intent incomplete` now land on the fields needed to fix the warning instead of hiding them behind a collapsed panel.

Browser QA:

- In the in-app browser, started a quick session, selected a SOXL 4H candle with a real chart click, and created an `ENTRY` label.
- Clicked the Review `entry intent incomplete` QA row.
- Verified Capture entered edit mode with lifecycle, setup/trade metadata, bias, direction, reason codes, and notes visible immediately.
- Left the local QA label/session in place rather than deleting local data without explicit action-time confirmation.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/CapturePanel.test.tsx
```

### Slice 106: Guided QA Repair Path

Added:

- Edit mode now shows a `QA repair` strip when the current saved label has a common dataset-trust gap.
- Incomplete `ENTRY` labels get `Long Ticker Setup` and `Short Ticker Setup` repair buttons.
- The entry repair creates a setup id when needed, sets role to `entry`, and fills explicit bias/direction.
- Incomplete `EXIT` labels can use `Link Previous Label` to copy the previous label's setup/trade context and set parent linkage.

Browser QA:

- In the in-app browser, created a local `ENTRY` label that produced `entry intent incomplete`.
- Clicked the Review Intent QA row.
- Verified the `QA repair` strip appeared with `Long Ticker Setup` and `Short Ticker Setup`.
- Clicked `Long Ticker Setup`, saved the label, and confirmed Review changed from `INTENT GAPS 1` to `INTENT GAPS 0`.
- The local QA session/label remains in place.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/CapturePanel.test.tsx
```

### Slice 107: Active Candle Selection Contract

Added:

- Selected candles now show active and related marker states across chart panels.
- Capture now has a selected-candle card with ticker, timeframe, timestamp, replay provenance, and bar index.
- Open sessions auto-resume locally, first label capture can start a Quick capture session, and `U` / `Undo Last` is available for correction.

### Slice 108: Capture-First Right Panel

Added:

- Capture owns the primary right-rail surface.
- Dataset Trust is summarized compactly in Capture and stays collapsed in the Review drawer until opened.

### Slice 109: Post-Create Label Flow

Added:

- Regular-mode label creation stays on the selected candle.
- Replay-mode label creation advances to the next candle while preserving created-label confirmation.
- Button and keyboard label creation now share the same post-create flow.

### Slice 110: Label Pin States And Clustering

Added:

- Label pins now distinguish normal, selected, QA warning, QA blocker, and same-candle cluster states.
- Cluster clicks focus the first label and expand the cluster into individual pins.

Verified:

```bash
pnpm workflow:focused-ui -- --verify
```

### Slice 111: Basic Navigation Package

Added:

- `[` / `]` keyboard shortcuts navigate previous/next saved labels.
- Shifted brackets navigate previous/next labels with validation issues.
- Double-clicking a chart resets/fits the visible range.
- Mouse wheel chart zoom is enabled while drag-panning remains limited to explicit Pan mode.

Browser QA:

- In the Codex in-app browser at `http://127.0.0.1:5173/`, verified label keyboard navigation opens the label editor.
- Verified shifted-bracket QA navigation opens labels with validation warnings.
- Verified double-click reset on the chart produced no console errors.
- Created two temporary local `SKIP` labels for the browser check and left them in place because deleting local app data requires explicit action-time confirmation.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/store/useAppStore.test.ts src/components/ReplayToolbar.test.tsx src/charts/ChartGrid4H.test.tsx
pnpm workflow:focused-ui -- --verify
```

### Slice 112: Actionable QA Issue Queue

Added:

- Dataset Trust now shows export readiness by issue severity: blockers, warnings, info, and a clear export readiness label.
- Validation issues are normalized into a review queue with stable issue IDs, severity, label IDs, message, and suggested fix copy.
- Label-specific issue rows remain clickable and jump to the affected label/candle repair UI.
- Dataset/global issue rows are selectable and show dataset context instead of looking like missing or broken labels.
- Data-review classifications are included as info-level queue rows.

Browser QA:

- In the Codex in-app browser at `http://127.0.0.1:5173/`, opened Dataset Trust and verified `Issue Queue`, export readiness, suggested fixes, and info rows render.
- Clicked a warning label issue and verified the label editor opens.
- Clicked an info/data-review issue and verified it selects without trying to focus a missing label.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/ReviewPanel.test.tsx
```

### Slice 113: Replay-Clean Labeling Coverage

Added:

- Capture selected-candle details now show `Replay-safe` in replay mode and `Future-visible` in regular mode.
- Captured label history rows now include provenance badges: `Replay-safe`, `Future-visible`, or `Regular`.
- Capture compact trust now shows a replay-safe label count instead of another duplicate intent counter.
- Review panel now has a Replay Clean coverage card that separates replay-safe, future-visible, regular, simulation-safe, and total labels.
- Review copy explicitly says to use replay-safe labels for training/simulation or collect replay labels when none exist.

Browser QA:

- In the Codex in-app browser at `http://127.0.0.1:5173/`, verified replay-clean coverage, training-set copy, replay-safe badges, and future-visible badges render in the live app.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/CapturePanel.test.tsx src/components/ReviewPanel.test.tsx
```

### Slice 114: Setup/Trade Linkage Editor

Added:

- Capture Details now has a dedicated Trade Linkage editor with `Entry Trade`, `Attach Exit`, `Invalidate Setup`, and `Skip Review` actions.
- Entry linkage creates setup/trade IDs and marks the role as `entry`.
- Exit linkage attaches to the latest open trade, sets `parentLabelId`, and marks the role as `exit`.
- Invalidation linkage attaches to the latest setup or trade without requiring a trade ID.
- Skip review clears trade/parent linkage and marks the role as `skip`.
- Capture Details now shows compact trade lifecycle cards with open, exited, invalidated, unresolved, and outcome-missing/computed states.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/CapturePanel.test.tsx
pnpm workflow:focused-ui -- --verify
```

Browser QA:

- In the Codex in-app browser at `http://127.0.0.1:5173/`, opened Capture Details and verified the Trade Linkage editor and Trade Cards render.
- Verified linkage actions stay disabled until a candle is selected.
- Selected a SOXL 4H candle and verified `Entry Trade`, `Invalidate Setup`, and `Skip Review` enable while `Attach Exit` remains disabled without an open trade.
- Verified `Entry Trade` populates setup/trade linkage fields in the live UI.

### Slice 115: Outcome Status Separation

Added:

- Trade events now persist `outcomeStatus` and `outcomeRuleVersion` alongside evaluation-only outcome values.
- Deterministic outcome calculation marks labels as `computed` with `outcome_rule_v1`, or `insufficient_future_bars` when the label is too close to the end of the loaded dataset.
- Export validation now summarizes `computed`, `pending`, `insufficient_future_bars`, `missing_exit`, `invalidated`, and `not_computed` outcome states without adding outcome fields to the decision CSV.
- Review now shows outcome status buckets and the active outcome rule version.
- Capture outcome panel now shows explicit status text, horizon bars, and rule version instead of only `Not calculated` or a bar count.
- Repo-local focused UI skill now documents the repeatable `pnpm workflow:focused-ui` / `pnpm test:focused-ui` / in-app browser / `pnpm workflow:focused-ui -- --verify` loop.

Verified:

```bash
pnpm --filter @edgelord/api test -- tests/exportRoutes.test.ts tests/outcomeService.test.ts tests/labelService.test.ts tests/labelRoutes.test.ts
pnpm --filter @edgelord/web test -- src/components/CapturePanel.test.tsx src/components/ReviewPanel.test.tsx src/store/useAppStore.test.ts
pnpm test:focused-ui
pnpm workflow:focused-ui -- --verify
```

Browser QA:

- In the Codex in-app browser at `http://127.0.0.1:5173/`, verified Capture shows explicit `Not computed` outcome state.
- Opened Dataset Trust and verified outcome status buckets render: `Computed`, `Pending`, `Insufficient`, `Missing Exit`, `Invalidated`, and `Rule`.

### Slice 116: Export Preview And Manifest

Added:

- Export validation responses now include a manifest preview with schema/export versions, export timestamp, filters, QA status, blocker/warning counts, included label types, row count, and outcome inclusion.
- JSON exports include QA status and included-label-type manifest fields.
- CSV exports include the manifest in the `x-edgelord-export-manifest` response header.
- Backend export routes now block failed-validation exports with HTTP `409` unless an explicit `allowBlocked=true` override is used.
- Toolbar export controls now show preview status, rows, schema, scope, included label types, outcome inclusion, and QA status before download.
- Toolbar CSV/JSON links are disabled when export blockers exist, so blocked/leaky records cannot be exported silently from the UI.

Verified:

```bash
pnpm --filter @edgelord/api test -- tests/exportRoutes.test.ts
pnpm --filter @edgelord/web test -- src/components/ReplayToolbar.test.tsx
pnpm test:focused-ui
pnpm workflow:focused-ui -- --verify
```

Browser QA:

- In the Codex in-app browser at `http://127.0.0.1:5173/`, verified the toolbar export preview renders current QA status, row count, schema, export scope, included label types, outcome inclusion, and QA status.
- Current local session showed `WARNINGS 3`, `Rows 3 · Schema trade-events.v1 · Session`, `Types SKIP 3`, and `Outcomes JSON only · QA warning`.
- Verified CSV/JSON links remain enabled when validation has warnings but no blockers, with session-scoped export URLs.
- Verified there were no current browser console errors after the export-preview render.

### Slice 117: Review Dashboard / Session Summary

Added:

- Review now has a compact always-visible session summary above Dataset Trust.
- The summary shows active/all-label scope, current trust status, total label count, top label type, top ticker, top timeframe, replay-safe count, linked trade count, outcome count, blocker/warning counts, and the next review action.
- The summary is intentionally read-only and descriptive: no strategy conclusions, performance analytics, backtesting, or AI scoring.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/ReviewPanel.test.tsx
pnpm workflow:focused-ui -- --verify
```

Browser QA:

- In the Codex in-app browser at `http://127.0.0.1:5173/`, verified `Session summary dashboard` renders above Dataset Trust.
- Current local session showed `Active Session`, `Needs Review`, `Labels 3`, `Top Type SKIP`, `Ticker SOXL`, `Timeframe 4H`, `Replay-safe 0`, `Linked 0`, `Outcomes 0`, `QA 0/3`, and `Next Review: Review warnings`.
- Verified there were no current browser console errors after the summary render.

### Slice 118: Dataset Review Usability Follow-up

Added:

- Session-summary `Next Review` is now actionable when there are blockers, warnings, existing labels, or no active session.
- Warning/blocker datasets auto-open Dataset Trust once and select the matching QA filter, so review issues are not hidden behind a collapsed drawer.
- Empty no-session dashboards can start `Quick capture` directly.
- Active-session/no-label dashboards show a passive `Select a candle` next step instead of a dead button.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/ReviewPanel.test.tsx
pnpm workflow:focused-ui -- --verify
```

Browser QA:

- In the Codex in-app browser at `http://127.0.0.1:5173/`, verified the no-label/all-label dashboard shows `Next Review: Select a candle`, exposes the session-summary action for starting capture, keeps Dataset Trust collapsed because there are no QA issues, and has no browser console errors.
- Full workflow verification also tightened the smoke test's Replay-mode locator to the toolbar replay controls, because visible QA issue rows can contain replay-related text.

### Slice 119: Dataset Review Info-State Consistency

Added:

- Session summary QA now shows blocker/warning/info counts as `QA B/W/I`, so info-only review states are not hidden behind `0/0`.
- Stale `Warnings` or `Errors` filters reset to `All` when there are no matching issues.
- No-session empty state now says `Start session` and still starts Quick capture.
- Active-session info-only state now says `Info only` with `Next Review: Review info`.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/ReviewPanel.test.tsx
```

Browser QA:

- In the Codex in-app browser at `http://127.0.0.1:5173/`, verified the active-session info-only state shows `Info only`, `QA B/W/I 0/0/2`, and `Next Review: Review info`.
- Verified the QA queue defaults to `All` and shows both data-review info rows instead of `No issues match this filter`.
- Verified there were no current browser console errors.

### Slice 120: Simple Labeling Surface Cleanup

Added:

- Review data is now collapsed behind a single `Review Data` secondary panel instead of keeping the session dashboard and dataset trust wall visible by default.
- Capture keeps selected candle details and fast label actions primary; indicator, structure, and paired ETF readouts now live under a collapsed `Market Context` section.
- Capture only shows the compact data-review strip when the label set has blockers or warnings.
- Toolbar export controls now keep only scope, status, CSV, and JSON; verbose manifest/type/outcome details are no longer prime toolbar content.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/ReviewPanel.test.tsx src/components/CapturePanel.test.tsx src/components/ReplayToolbar.test.tsx
pnpm workflow:focused-ui -- --verify
```

Browser QA:

- Attempted to use the Codex in-app browser through the Browser Use plugin, but this session did not expose the required Node REPL browser-control tool.
- Local dev server is still available at `http://127.0.0.1:5173/`.
- Full focused-ui smoke, tests, lint, typecheck, and production build passed.

### Slice 121: Single Secondary Workflow Drawer

Added:

- The right rail now keeps `Capture` as the only always-visible working surface.
- Session management and review data are consolidated behind one collapsed `Session / Review` drawer.
- The drawer summary shows current session, label count, and QA count when there are blockers or warnings.
- Underlying session, review, validation, and export logic remain intact; only the default visible surface was simplified.

Verified:

```bash
pnpm test:focused-ui
pnpm workflow:focused-ui -- --verify
```

Browser QA:

- Not run through Browser Use in this turn because the required Codex in-app browser Node REPL control tool was not exposed.
- Per repo rule, standalone Playwright/Chrome DevTools fallback was not used.
- `verify:focused-ui` now runs `pnpm test:focused-ui && pnpm verify`; the old Playwright smoke is renamed to `smoke:ui:legacy-playwright` and is opt-in only.

### Slice 122: Toolbar Primary/Secondary Split

Added:

- Data import and Export controls now sit behind compact toolbar utility drawers.
- Replay start/play/step controls now sit behind a compact Replay settings drawer, leaving only Regular/Replay mode switching and the current visibility state in the main toolbar.
- Market, Replay mode switching, candle navigation, and Session status stay visible as the primary toolbar workflow.
- The shell now clamps horizontal overflow, keeps the workspace in the `1fr` grid row even when no error banner is present, and fills the available vertical chart area above the fixed Capture drawer.
- The desktop workspace now names its grid lanes for tools, charts, and capture, and the chart stack clips at its column boundary so chart internals cannot bleed under the right Capture rail.
- The compact breakpoint now starts at 1180px so browser-panel widths do not keep the crowded desktop toolbar.
- Candle hit targets now accept pointer events directly, so clicking a visible candle immediately updates the chart readout and Capture panel.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/ReplayToolbar.test.tsx src/charts/ChartGrid4H.test.tsx
pnpm workflow:focused-ui -- --verify
```

Browser QA:

- In the Codex in-app browser at `http://127.0.0.1:5173/`, reloaded the repaired app and confirmed the toolbar now exposes compact `Data` and `Export` utility summaries instead of the full import/export wall.
- Follow-up in-app browser DOM QA confirmed the topbar hierarchy is now `Market`, compact `Data`, `Replay`, compact replay settings, `Nav`, `Session`, and compact `Export`, instead of showing every replay/date/import/export control in one row.
- Follow-up in-app browser DOM QA confirmed the layout order is Drawing tools, synchronized chart grid, then Decision capture panel after the chart/capture column fix.
- Follow-up in-app browser pointer QA confirmed the custom price crosshair stays mounted while moving across several chart x-positions, with synchronized hover state across the visible chart panels.
- Selected the latest visible `SOXL 4H` candle and verified the chart readout changed to `2026-04-27 O 128.77 H 129.43 L 117.88 C 119.55 Vol 526.8K -7.16%`.
- Verified Capture immediately changed from `No candle selected` to `SOXL 2026-04-27` with label buttons enabled.
- Browser-level screenshot capture still timed out via `Page.captureScreenshot`; OS-level screenshot capture hit the wrong Codex thread, so visual closeout used DOM/browser state assertions plus the full repo verification gate.
- Follow-up in-app browser screenshot QA confirmed the huge dead gap between the chart/session strip and bottom Capture drawer is gone.

### Slice 123: Crosshair Persistence Repair

Added:

- Price-pane crosshair is now rendered by the React overlay from the shared hovered timestamp instead of relying only on the embedded chart library's native crosshair.
- Candle click hit targets remain active, but they no longer determine whether a visible crosshair is available while scanning the chart.
- Chart tests now cover that the price crosshair remains mounted while hovering candle hit targets and clears only on chart leave.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/charts/ChartGrid4H.test.tsx
pnpm workflow:focused-ui -- --verify
```

Browser QA:

- In the Codex in-app browser at `http://127.0.0.1:5173/`, reloaded the app and moved the pointer across multiple x-positions on the chart.
- Confirmed `.price-crosshair` remained mounted and synchronized across visible chart panels while the hover readout stayed present.

## Recommended Next Slice

The consultant-reconciled dataset-trust sequence is complete through Slice 86. V2 QA hardening is complete through **Slice 124: Selector Redundancy Cleanup**.

Suggested scope:

- Use the in-app browser to review the repaired toolbar/capture loop in normal use: switch ticker/timeframe, open Data/Export only when needed, select candles, label, undo, and inspect `Session / Review`.
- Fix only the next concrete browser-visible friction; avoid broad redesign while the core capture loop is stabilizing.
- Keep the existing Capture and Dataset Trust surfaces authoritative for editing and issue repair.
- Keep rule candidate exploration and walk-forward backtesting deferred until QA review is useful.

Avoid adding strategy mining, new drawing tools, or more indicators until the completed dataset workflow has been reviewed in the browser.

### Slice 124: Selector Redundancy Cleanup

Added:

- The left rail button selectors remain the single ticker/timeframe target controls.
- The topbar Market zone no longer renders duplicate ticker/timeframe dropdown selectors.
- Toolbar tests now cover the trimmed toolbar surface while ToolRail tests continue to cover ticker/timeframe targeting.

Verified:

```bash
pnpm --filter @edgelord/web test -- src/components/ReplayToolbar.test.tsx src/components/ToolRail.test.tsx
pnpm workflow:focused-ui -- --verify
```

Browser QA:

- In the Codex in-app browser at `http://127.0.0.1:5173/`, reloaded the app and confirmed there are no `Focused ticker` or `Focused chart timeframe` dropdown controls.
- Confirmed the rail still has one `Target SOXL` button and one `Target timeframe 4H` button.

## Consultant Reconciliation

ChatGPT Pro reviewed the current screenshots and project packet on 2026-04-27.

Accepted direction:

- Keep EdgeLord as visual chart review plus structured dataset capture.
- Treat grid mode as a context scanner and focused mode as the primary labeling surface.
- Prioritize dataset trust before more chart features.
- Add versioning, leakage guards, linkage/intent fields, multi-timeframe context, derived decision features, paired ETF/ratio features, and export validation before strategy mining.

Detailed sequence:

- `docs/CONSULTANT_IMPLEMENTATION_PLAN.md`

Raw artifact:

- `artifacts/chatgpt-consultant/2026-04-27-edgelord-ux-architecture/raw-response.md`

## Verification Defaults

Use this command sequence while editing focused UI/capture work:

```bash
pnpm workflow:focused-ui
pnpm test:focused-ui
```

Use this one-command closeout after changes:

```bash
pnpm workflow:focused-ui -- --verify
```

Repo-local skill: `.codex/skills/focused-ui-verify/SKILL.md`.

The first command prints the current and next slice. The second is the fast capture panel/store preflight. The closeout command runs `pnpm test:focused-ui` plus the full repo gate.

Legacy note: `pnpm smoke:ui:legacy-playwright` exists only as opt-in legacy tooling. Do not run it for normal EdgeLord UI verification unless the user explicitly authorizes standalone Playwright for that turn.

Use the standard gate for non-UI work:

```bash
pnpm verify
```

For UI interaction checks, use the Codex in-app browser. Do not default to Chrome DevTools or external Playwright sessions.

Repo rule: EdgeLord live UI review must use the Codex in-app browser. Do not use standalone Playwright, Chrome DevTools, external browser sessions, or generic browser automation unless the user explicitly authorizes that fallback in the same turn. The Browser plugin's internal `tab.playwright` API is allowed only when it controls the Codex in-app browser via backend `iab`.

For visual screenshots when browser screenshots time out, use:

```bash
python3 /Users/JoeyKenney/.codex/skills/codex-window-screenshot/scripts/capture_codex_window.py
```

## Notes For Fresh Codex Chat

- Start from `/Users/JoeyKenney/Documents/EdgeLord`.
- Read `AGENTS.md`.
- Read `docs/CURRENT_HANDOFF.md`.
- Read the bottom/latest portion of `docs/TRADINGVIEW_WORKSTATION_PLAN.md`.
- Read `docs/CONSULTANT_IMPLEMENTATION_PLAN.md` before changing export/schema/UI direction.
- Continue with a browser QA pass or the next v2 dataset-review slice unless the user redirects.
