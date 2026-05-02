# EdgeLord Next Implementation Plan

## Current Priority

Pivot from workstation polish to strategy-discovery labeling. The next work should make EdgeLord produce clean replay-safe labels quickly, then inspect those labels with `research/` scripts.

Primary plan:

- `docs/STRATEGY_DISCOVERY_PIVOT.md`
- `docs/CHATGPT_PRO_DEVELOPMENT_PLAN.md`
- `docs/CONSULTANT_IMPLEMENTATION_PLAN.md`
- `docs/TRADINGVIEW_WORKSTATION_PLAN.md`

Next recommended step:

- **Slice 126: Label Factory Default**
  - Make the default surface one focused chart plus selected candle, `ENTRY` / `EXIT` / `SKIP` / `INVALID`, undo, and recent labels.
  - Keep Details, Session, Review, Data, and Export collapsed until needed.
  - Make replay-safe labeling the default path for training data.
  - Keep regular-mode labels allowed but clearly future-visible and excluded from training exports by default.
  - Do not add new charting, drawing, dashboard, responsive, broker, or strategy-mining UI.
  - Status: done. The app now defaults to replay mode and focused chart layout, chart load/import auto-selects the current replay candle, Capture shows last-5 labels, outcome calculation is inside Details, stale Session/Review App imports were removed, and focused verification plus full `pnpm verify` passed.

Next recommended implementation step:

- **Slice 127: Simple Research Export Path**
  - Add a first-class simple label export path that matches the pivot mental model.
  - Keep the existing feature-rich export intact.
  - Make regular/future-visible labels excluded or clearly separated by default for research use.
  - Feed the output into `research/summarize_labels.py` without manual column interpretation.
  - Status: done. `/export/research-labels` now emits replay-safe-by-default `csv` and `jsonl`, the toolbar exposes `Labels CSV` and `JSONL` separately from `Features CSV` and `Full JSON`, export tests cover replay-safe filtering and opt-in future-visible inclusion, and `research/summarize_labels.py` can read piped `/dev/stdin` output.

Next recommended implementation step:

- **Slice 128: Label Count Progress Loop**
  - Make the Capture surface show replay-safe label progress toward the 300-label gate.
  - Keep it compact and non-dashboard-like.
  - Do not add strategy scoring or backtesting UI.
  - Status: done. Capture now shows `Replay-safe labels 0 / 300` plus the remaining gate count, and Browser Use verified it remains visible in the narrow in-app browser layout with the replay label buttons still present.

Next recommended implementation step:

- **Slice 129: First Labeling Session Smoke**
  - In the in-app browser, create one replay-safe `SKIP` label from the selected candle.
  - Verify the progress strip increments, recent labels update, and `Labels CSV` exports one replay-safe row.
  - Keep this as local smoke data only; do not start rule discovery.

Hard gate:

- No new charting features, drawing features, dashboard features, responsive polish, broker features, new indicators, or strategy-mining UI until at least 300 replay-safe decision labels exist unless the user explicitly overrides the gate.
- `SKIP` labels are required for bars that were seriously reviewed and rejected, or the research dataset must define reviewed non-entry bars as negative examples.

## Saved QA Fix Plan

The consultant-reconciled dataset-trust sequence is complete through **Slice 86: Outcome Calculation UI Action**.
V2 has started with **Slice 87: Label QA Review Mode**.

Completed product-pass hardening:

- Browser smoke now covers label creation, edit, outcome calculation, JSON export, and delete.
- The smoke verifies outcome fields round-trip through JSON export.
- Browser smoke also checks the Label QA review section and warning filter.

Completed product-pass hardening:

- Data coverage endpoint and toolbar import controls now make the loaded dataset range and large gaps visible.
- Import can target explicit start/end dates and `1Min` or `5Min` source bars from the UI.
- Aggregation is now source-timeframe aware for `1Min` and `5Min` imports.
- SOXL/SOXS have been backfilled from `2024-01-02` through `2026-04-27` with `Coverage gaps 0`.
- Alpaca imports now request adjusted bars by default.
- Successful imports now replace stale aggregate cache rows inside the requested ticker/date range, preventing old raw/split aggregate buckets from surviving a refresh.
- The live adjusted `5Min` cache rebuild completed for SOXL/SOXS from `2024-01-01` through `2026-04-28`.
- Browser/API checks now show `Coverage gaps 0` and `Data warnings 11`, down from the stale-cache count of `17`.
- The remaining discontinuities are now classified as review-only SOXL/SOXS volatility/session gaps, so the toolbar shows `Data review 11` instead of `Data warnings 11`.
- Export validation only promotes true `possible_bad_source_data` events into validation warnings.
- Review panel now explains the data-review classifications, currently `session gap 6` and `leveraged ETF volatility 5`.
- Label QA no longer uses vague `No label context` copy for dataset/global or missing-label issue rows.
- During chart load, the toolbar now shows `Loading coverage` instead of the contradictory `No coverage loaded` state.
- Fast capture now stays in capture mode after saving a label; editing a label is explicit from history/review.
- Review QA now loads label context for all-label validation reports, so label-specific issues are understandable and focusable instead of dead rows.
- Import controls now show scoped import success/failure status and clear stale import status when the import inputs change.
- Export controls now show scope plus label count, and disabled export controls are non-navigable.
- Saved-label editing now opens Details automatically, so QA warnings expose the intent/linkage fields needed to fix them.
- Edit mode now includes guided QA repair buttons for incomplete entry intent and exit linkage.

Recommended next action:

- Run a browser QA pass against the refreshed dataset, especially replay navigation, labeling, review health, exports, and drawing selection.
- Browser-test label selection/capture from the chart with no active session, then after starting a session.
- Implement the next live QA review finding before rule/backtest work.
- Keep rule candidate explorer and walk-forward backtest harness deferred until QA review is useful.

Do not start strategy mining, backtesting, new indicators, new drawing tools, or broad UI redesign without choosing that v2 direction explicitly.

## Build Order

1. **Slice 88: Session Gating UX**
   - Show `Start or resume a session to label candles` when label controls are blocked by missing session.
   - Keep chart inspection available, but distinguish inspection from session-backed labeling.
   - Add a `Start Session` shortcut inside capture.
   - Verify in the in-app browser that no-session state is obvious and that starting a session enables labeling.
2. **Slice 89: Review Panel Reachability**
   - Keep `Session`, `Review`, and `Capture` affordances reachable when details/editing are expanded.
   - Add a compact review/QA summary near capture.
   - Auto-reveal review QA when validation issues exist.
   - Verify in the in-app browser that a new label can be reviewed without scrolling gymnastics.
3. **Slice 90: Replay Date Input Cleanup** *(done)*
   - Accept ISO `YYYY-MM-DD` and browser-native date entry predictably.
   - Show invalid-date feedback instead of silently jumping.
4. **Slice 91: Data Quality / Adjustment Warning** *(done)*
   - Detect large discontinuities per ticker/timeframe and surface chart/export validation warnings.
   - Specifically catch the SOXS 2H March adjustment jump.
5. **Slice 92: Drawing Tool Feedback** *(done)*
   - Improve drawing active-state instructions, successful creation feedback, drawing selection, and delete enablement.
6. **Slice 93: Research Readiness Gate** *(done)*
   - Add a read-only readiness summary before rule discovery/backtesting.
   - Surface sample size, replay coverage, entry/exit counts, setup linkage, outcomes, and the next blocking gate.
7. **Slice 94: Data Coverage + Import Range Controls** *(done)*
   - Add data coverage summaries and large gap detection.
   - Expose explicit import start/end/base timeframe controls.
   - Refresh coverage after load/import and surface compact toolbar gap status.
8. **Slice 95: Coverage Backfill + Source-Timeframe Aggregation** *(done)*
   - Accept sparse-but-sufficient source buckets instead of exact minute completeness.
   - Make aggregation source-timeframe aware for `1Min` and `5Min`.
   - Default UI imports to `5Min` because it produced cleaner Alpaca IEX historical coverage.
   - Backfill SOXL/SOXS through the current research window and verify `Coverage gaps 0`.
9. **Slice 96: Adjusted Import + Aggregate Cache Rebuild Guard** *(done)*
   - Default Alpaca provider requests to adjusted bars (`adjustment=all`).
   - Collect provider data before mutating aggregate cache rows, so failed provider requests do not wipe existing aggregates.
   - Delete stale aggregate rows for requested tickers/timeframes/date range before inserting refreshed aggregates.
   - Rebuilt the local aggregate cache, verified `Coverage gaps 0`, and reduced browser `Data warnings` from `17` to `11`.
10. **Slice 97: Data Warning Classification**
   - Inspect the remaining warnings by ticker/timeframe/date.
   - Separate true source-data/adjustment failures from legitimate high-volatility ETF moves.
   - Add warning severity/copy so toolbar QA distinguishes `data error` from `large real move`.
   - Verify the toolbar, review panel, and export validation still keep real data problems visible without over-warning normal labels.
   - Status: done. Current adjusted SOXL/SOXS dataset shows `Data review 11` and no current bad-source `Data warnings` badge.
11. **Slice 98: Browser QA Pass + Next Live Friction Fix**
   - Exercise replay navigation, candle selection, label capture/edit/delete, review QA, export links, drawing selection/delete, and import controls in the in-app browser.
   - Status: started. First live friction point was that `DATA REVIEW 11` had no Review-panel explanation.
   - Added Review-panel data-review classification summary.
   - Browser verified current classification breakdown: `session gap 6`, `leveraged ETF volatility 5`.
12. **Slice 99: Global QA Issue Context**
   - Label QA currently shows `No label context` for dataset/global issues where `labelId` is null.
   - Replace that copy with clearer global context such as `Dataset issue` or `Global export check`.
   - Keep label-specific focus behavior for issues with a valid label id.
   - Status: done. Dataset/global issues show `Dataset issue`; label references missing from the loaded panel context show `Missing label context`.
13. **Slice 100: Coverage Loading State Clarity**
   - First live labeling-flow QA friction was the toolbar showing `Loading` and `No coverage loaded` at the same time while charts were still fetching.
   - Show `Loading coverage` whenever chart data is loading and coverage has not returned yet.
   - Status: done. In-app browser verified the transient `Loading coverage` state and final return to `2024-01-02 to 2026-04-27` with `Data review 11`.
14. **Slice 101: Fast Capture Loop**
   - In the in-app browser, select a chart candle with no active session and confirm the blocked labeling state is understandable.
   - Start a session from Capture and create a narrow test label.
   - Review whether the label appears in Capture/Review without confusing navigation.
   - Fix the smallest live friction found in that flow.
   - Status: done. First live friction was auto-opening edit mode after label creation, which blocked the next capture. Created labels now leave capture buttons enabled and show edit controls only when a saved label is explicitly opened.
15. **Slice 102: Browser Review/Export QA**
   - Continue the in-app browser QA pass from the refreshed dataset.
   - Exercise Review filters, active-session/all-label toggles, CSV/JSON export actions, drawing selection, and import controls.
   - Fix the smallest live friction found in that flow.
   - Status: done. First live friction was label-specific QA rows in review/export validation without loaded label context. The labels endpoint and review load path now support all-label context, so QA rows show concrete `ENTRY SOXL 4H ...` context and remain focusable.
16. **Slice 103: Browser Drawing/Import QA**
   - Continue the in-app browser QA pass over drawing selection/delete affordances and import controls.
   - Verify the user can understand import failure/loading/success states without reading console output.
   - Fix the smallest live friction found in that flow.
   - Status: done. Import failure/success status now appears in the Data controls, stale import status clears when import inputs change, and browser QA verified horizontal-level drawing creation/selection without deleting local data.
17. **Slice 104: Browser Export/Replay QA**
   - Continue the in-app browser QA pass over CSV/JSON export links and replay navigation.
   - Verify disabled/export scope states, replay date controls, and keyboard/toolbar navigation remain understandable against the refreshed dataset.
   - Fix the smallest live friction found in that flow.
   - Keep strategy mining/backtesting deferred until the workstation QA surface is stable.
   - Status: done. Export controls now show `All N labels` or `Session N label(s)`, disabled export controls have no `href`, and in-app browser QA verified export links plus replay date/next/prev navigation.
18. **Slice 105: Browser QA Closeout + Next Dataset-Trust Slice**
   - Continue the in-app browser pass over the remaining capture/review/export/drawing edge states.
   - Fix the smallest remaining live friction if one appears.
   - If the QA pass is clean, move to the next dataset-trust slice rather than adding charting features.
   - Keep strategy mining/backtesting deferred until the labeled dataset is cleaner and review QA is useful.
   - Status: done. First live friction was that `entry intent incomplete` QA rows opened edit mode while the Details fields needed to fix intent stayed collapsed. Saved-label editing now opens Details automatically, and in-app browser QA verified the intent fields are visible after clicking the QA row.
19. **Slice 106: Guided QA Repair Path**
   - Move back from broad QA hardening to dataset trust.
   - Add a compact guided fix path for `entry_intent_incomplete` and `exit_linkage_incomplete` so users can repair common validation issues quickly.
   - Keep the fix path focused on existing fields: setup/trade IDs, parent label, decision role, bias, and trade direction.
   - Do not add strategy mining, new indicators, or backtesting in this slice.
   - Status: done. Edit mode now shows a `QA repair` strip for incomplete entry intent and exit linkage. Browser QA verified `Long Ticker Setup` fixes an entry intent warning and Review updates to `INTENT GAPS 0`.
20. **Slice 107: Active Candle Selection Contract**
   - Implement the first slice from `docs/CHATGPT_PRO_DEVELOPMENT_PLAN.md`.
   - Make selected candle state impossible to misunderstand before expanding QA/replay/export work.
   - Keep strategy mining/backtesting deferred.
   - Status: done. Selected candle now has active/related chart marker states, a Capture-panel selected-candle card, session auto-resume/first-label auto-start, and `U` / `Undo Last`.
21. **Slice 108: Capture-First Right Panel**
   - Reorder Capture/Edit/Trust surfaces so current selection and label actions dominate the right panel.
   - Status: done. Capture owns the primary right rail; compact trust appears in Capture, and the full Dataset Trust drawer stays collapsed until opened.
22. **Slice 109: Post-Create Label Flow**
   - Harden keyboard/button label creation, mode-specific advance behavior, immediate edit, and undo.
   - Status: done. Regular capture stays on the selected candle; replay capture advances to the next candle after save while preserving the created-label confirmation.
23. **Slice 110: Label Pin States And Clustering**
   - Add selected/warning/blocker/cluster pin states without making normal pins larger.
   - Status: done. Label pins now show selected/warning/blocker states and cluster overlapping same-candle labels until one is selected.
24. **Slice 111: Basic Navigation Package**
   - Add double-click fit, keyboard label/QA navigation, and viewport preservation/sync.
   - Status: done. `[` / `]` navigate labels, shifted brackets navigate validation-issue labels, double-click resets chart fit, and wheel zoom is enabled while drag pan remains explicit.
25. **Slice 112: Actionable QA Issue Queue**
   - Turn validation counters into clickable blocker/warning/info issue rows.
   - Status: done. Dataset Trust now has severity totals, export readiness, suggested fixes, label jumps, and selectable dataset/global info rows.
26. **Slice 113: Replay-Clean Labeling Coverage**
   - Separate replay-safe labels from regular/future-visible labels in capture/review/export readiness.
   - Status: done. Capture and Review now show replay-safe/future-visible provenance badges and replay-clean coverage.
27. **Slice 114: Setup/Trade Linkage Editor**
   - Make setup/trade linkage more explicit and lifecycle-oriented for entries, exits, invalidations, and outcomes.
   - Status: done. Capture Details now has explicit entry/exit/invalidation/skip linkage actions and compact trade lifecycle cards.
28. **Slice 115: Outcome Status Separation**
   - Keep decision labels clean while making outcome status explicit and deterministic.
   - Status: done. Labels now persist explicit outcome status and rule version, Review shows outcome buckets/rule version, and decision CSV remains outcome-free.
29. **Slice 116: Export Preview And Manifest**
   - Make exported datasets auditable before download.
   - Status: done. Toolbar export preview now shows row count, schema, QA blockers/warnings, included label types, and outcome inclusion. Failed-validation exports are blocked unless explicitly overridden.
30. **Slice 117: Review Dashboard / Session Summary**
   - Add a read-only summary layer for dataset coverage and session progress.
   - Show label counts by type/ticker/timeframe, replay-safe vs future-visible coverage, setup/trade linkage coverage, outcome status buckets, and blocker/warning totals.
   - Do not add strategy conclusions, performance analytics, backtesting, or AI scoring.
   - Status: done. Review now shows a compact always-visible session summary with scope, trust status, label count, top type/ticker/timeframe, replay-safe count, linked trades, outcomes, QA counts, and next review action.
31. **Slice 118: Dataset Review Usability Follow-up**
   - Browser-test the new summary with Dataset Trust, capture/edit, and QA issue navigation.
   - Fix the smallest concrete review usability friction found.
   - Status: done. Warning/blocker datasets now auto-open Dataset Trust with the matching QA filter, no-session empty dashboards can start Quick capture, and active-session empty dashboards show a passive `Select a candle` next step instead of a dead button.
32. **Slice 119: Dataset Review Usability Follow-up**
   - Continue in-app browser QA over dashboard-to-review flows.
   - Good candidates: clickable dashboard filters or a compact unresolved-label review queue.
   - Status: done. Info-only states now show `QA B/W/I`, stale warning/error filters reset to `All`, no-session empty dashboards say `Start session`, and active-session info-only dashboards say `Review info`.
33. **Slice 120: Simple Labeling Surface Cleanup**
   - Collapse secondary dataset-review surfaces so the default right rail stays focused on selected candle plus label actions.
   - Collapse selected-candle indicator/pair/structure context under `Market Context`.
   - Remove verbose export manifest/type/outcome readouts from the main toolbar.
   - Status: done. Focused tests and full focused-ui verification passed; in-app browser control was attempted but unavailable in this session because the Browser Use Node REPL tool was not exposed.
34. **Slice 121: Simplified Workflow Browser QA**
   - Use the Codex in-app browser to review the simplified default loop: select candle, label with buttons/keys, inspect saved pin/card, open Review Data only when needed.
   - Delete or collapse any remaining visual surface that does not support that loop.
   - Keep underlying schema, validation, linkage, and export logic intact.
   - Status: done. Session management and review data now live behind one collapsed `Session / Review` drawer, leaving Capture as the only always-visible right-rail workflow surface. Focused UI tests passed; standalone Playwright/Chrome DevTools fallback was not used.
35. **Slice 122: Toolbar Primary/Secondary Split**
   - Keep Market, Replay, and candle navigation visible.
   - Move Data import and Export controls behind compact secondary drawers or one utility drawer.
   - Preserve all existing import/export behavior and validation states.
   - Status: done. Data, Replay setup, and Export now live behind compact toolbar utility drawers, primary toolbar controls stay visible, candle hit targets accept direct clicks, the shell keeps the workspace in the fill row when no error banner is present, chart internals clip before the reserved Capture column, and compact layout starts at browser-panel widths. In-app browser QA verified latest-candle selection updates both chart readout and Capture immediately, confirmed the dead chart-to-Capture gap is gone, confirmed the topbar hierarchy no longer exposes every replay/date/import/export control in one row, and confirmed the layout order is tools, chart grid, then Decision capture; `pnpm workflow:focused-ui -- --verify` passed.
36. **Slice 123: Repaired Loop Browser QA**
   - Use the Codex in-app browser to work the repaired loop end to end: switch ticker/timeframe, select candles, label, undo, inspect `Session / Review`, and open Data/Export only when needed.
   - Fix only the next concrete browser-visible friction in the default capture workflow.
   - Keep strategy mining, new indicators, and backend/export schema changes deferred.
   - Status: done. The next concrete browser-visible friction was intermittent crosshair visibility while moving across chart overlays. Price-pane crosshair rendering now comes from the shared hover timestamp, stays mounted while hovering candle hit targets, and clears only on chart leave. In-app browser QA confirmed crosshair presence across multiple chart x-positions; `pnpm workflow:focused-ui -- --verify` passed.
37. **Slice 124: Repaired Capture Loop Browser QA**
   - Use the Codex in-app browser to work the repaired loop end to end: switch ticker/timeframe, select candles, label, undo, inspect `Session / Review`, and open Data/Export only when needed.
   - Fix only the next concrete browser-visible friction in the default capture workflow.
   - Keep strategy mining, new indicators, and backend/export schema changes deferred.
   - Status: done. The next concrete browser-visible friction was duplicate ticker/timeframe selection. The left rail button selectors remain the single ticker/timeframe target controls, and the topbar Market zone no longer renders duplicate dropdown selectors. In-app browser QA confirmed zero `Focused ticker` / `Focused chart timeframe` dropdowns and one rail `Target SOXL` / `Target timeframe 4H` control; `pnpm workflow:focused-ui -- --verify` passed.
38. **Slice 125: Repaired Capture Loop Browser QA**
   - Use the Codex in-app browser to work the repaired loop end to end: switch ticker/timeframe, select candles, label, undo, inspect `Session / Review`, and open Data/Export only when needed.
   - Fix only the next concrete browser-visible friction in the default capture workflow.
   - Keep strategy mining, new indicators, and backend/export schema changes deferred.
   - Status: next.
