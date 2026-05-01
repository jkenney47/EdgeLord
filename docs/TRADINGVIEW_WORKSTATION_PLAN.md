# TradingView-Style Workstation Plan

## Product Direction

EdgeLord should behave like a TradingView-style replay workstation with a decision-capture layer on top. The charting surface should feel familiar: chart first, dark workspace, drawing tools, replay controls, right price scale, bottom time scale, indicator panes, and direct candle markers. EdgeLord's difference is not charting novelty; it is structured behavioral data capture for later strategy extraction and backtesting.

We should copy the workflow pattern, not TradingView branding, proprietary implementation, or assets.

## Consultant Reconciliation

ChatGPT Pro reviewed the current workstation screenshots and implementation packet on 2026-04-27. The accepted recommendation is to keep the current product shape but shift the next phase toward dataset trust before adding more charting features.

Accepted priorities:

- Do not build a full TradingView clone.
- Do not pivot to spreadsheet-only labeling.
- Keep visual review as the labeling interface and make exports more rigorous.
- Add schema/export versioning, leakage guards, linkage/intent fields, multi-timeframe context, derived features, paired ETF/ratio features, and export validation before strategy mining.
- Treat grid mode as a context scanner and focused mode as the primary labeling surface.

Detailed implementation sequence:

- `docs/CONSULTANT_IMPLEMENTATION_PLAN.md`

## Architecture Direction

- Use `lightweight-charts` as the primary chart renderer.
- Keep Zustand as the app state layer.
- Keep the existing local API, SQLite cache, Alpaca import, aggregation, indicators, drawings, labels, and exports.
- Treat custom DOM charts as temporary scaffolding and replace them incrementally.
- Keep rendering components isolated from persistence logic.

## Workstation Layout

- Top toolbar: ticker/timeframe/import/replay/navigation controls.
- Left tool rail: cursor, trendline, horizontal level, breakout marker, label modes later.
- Center chart grid: SOXL and SOXS charts, synchronized by timestamp.
- Right inspector: capture panel first, then session/review.
- Bottom/embedded panes: indicator panes per chart.

## Interaction Model

- Click candle: select candle and update inspector/readout.
- Keyboard labels: `E`, `X`, `S`, `I`.
- Drawing tools:
  - trendline: click two points, drag either endpoint
  - level: click one point, drag vertically later
  - breakout marker: click one candle
- Replay mode:
  - hides future candles
  - regular mode shows all data
  - labels are allowed in either mode

## Data Integrity

- Labels remain structured `TradeEvent` rows.
- Indicators and structure snapshots are captured at label time.
- No forced pair distinction; infer pairs later.
- Audit log stays implementation-level, not a visible primary feature.

## Implementation Slices

### Slice 1: Lightweight Price Chart

Status: Done.

- Replace the handmade candle strip with `lightweight-charts` for OHLC bars.
- Preserve existing chart header, drawing buttons, labels, and indicator panes.
- Preserve candle selection behavior.
- Preserve replay visibility rules.
- Use the chart library's right price scale and bottom time scale.

Success: SOXL/SOXS render as real candlestick charts with selectable candles and existing capture flow still works.

### Slice 2: TradingView Workstation Shell

Status: Done.

- Add a left drawing tool rail.
- Move drawing actions out of each chart header.
- Tighten top toolbar to read like a charting app.
- Keep capture inspector sticky on the right.

Success: the first screen reads as a chart workstation, not a dashboard.

### Slice 3: Drawing Overlay V2

Status: Done.

- Rebuild trendline, horizontal level, and marker overlays against chart coordinates.
- Keep draggable trendline endpoints.
- Add clearer selected drawing affordances.

Success: drawing feels close to TradingView basics.

### Slice 4: Indicator Pane V2

Status: Done.

- Render indicator panes using chart-series style rendering instead of tiny DOM SVGs.
- Add scales where useful.
- Keep warm-up states.

Success: SMIO, Stoch RSI, WVF, and ATR can visually inform trades.

### Slice 5: Label Markers V2

Status: Done.

- Render entries/exits/skips/invalids directly on the chart.
- Add hover/click affordances for editing labels.
- Avoid marker collisions with drawings.

Success: decisions are visible in-context and can be reviewed quickly.

### Slice 6: Replay Polish

Status: Done.

- Add playback cursor/crosshair readout.
- Ensure SOXL/SOXS stay synchronized.
- Make replay/regular mode visually obvious without bias warnings.

Success: replay feels fast, obvious, and safe enough for high-volume labeling.

### Slice 7: Review Extraction Surface

Status: Done.

- Improve dashboard around exported behavior:
  - conditions before profitable entries
  - skipped-trade clusters
  - loss clusters
  - confidence/setup quality distributions

Success: data capture starts turning into strategy extraction.

### Slice 8: Export Hardening

Status: Done.

- Keep JSON as the full current-state export.
- Widen CSV flattening for strategy extraction:
  - full indicator state
  - paired ETF state at the same timestamp
  - recent structure context
  - drawing distances and prices

Success: exported CSV is directly useful for later analysis without needing to parse nested JSON first.

### Slice 9: Workstation Export Controls

Status: Done.

- Add CSV and JSON export links to the top toolbar.
- Scope exports to the active session when one exists.
- Keep empty export actions visibly disabled when there are no loaded labels.

Success: export is a first-class workstation action, not buried in the capture panel.

### Slice 10: Right Rail Cleanup

Status: Done.

- Remove duplicate export controls from the capture panel.
- Keep the capture panel focused on selected-candle context, labeling, editing, and label history.
- Preserve the top toolbar as the single export surface.

Success: the workstation has one obvious export location and less repeated chrome in the right rail.

### Slice 11: Smoke Verification Harness

Status: Done.

- Add a Playwright-backed `pnpm smoke:ui` script.
- Start the local API and Vite app inside the smoke script.
- Check API health, CSV export shape, and core browser UI landmarks.
- Keep the smoke test available as an explicit regression command instead of default verification.

Success: future implementation slices have a repeatable end-to-end sanity check beyond unit tests without making Playwright the default UI-inspection path.

### Slice 12: Export State Correctness

Status: Done.

- Keep active-session exports driven by the loaded session label list.
- Keep all-label exports driven by the all-label review summary.
- Avoid falsely disabling all-label exports after a session is ended or no session is active.

Success: toolbar export availability matches the export scope instead of stale panel state.

### Slice 13: Isolated Smoke Data

Status: Done.

- Run `pnpm smoke:ui` against a temporary SQLite database.
- Seed a smoke session and label through the HTTP API.
- Verify CSV export includes the seeded label and widened export columns.
- Verify the browser toolbar enables export from the all-label review summary.

Success: end-to-end smoke coverage exercises real label/export behavior without mutating local working data.

### Slice 14: Inspector Secondary Panels

Status: Done.

- Make capture the dominant right-inspector surface.
- Collapse session controls into a secondary panel.
- Collapse review detail into a secondary panel with compact summary state.
- Keep the right inspector fixed-height on desktop and preserve mobile bottom capture behavior.

Success: capture stays immediately reachable while session and review remain available without competing for vertical space.

### Slice 15: Responsive Inspector Smoke

Status: Done.

- Make the mobile right rail use a fixed bottom capture drawer with bounded height.
- Let session and review remain reachable in normal document flow on narrow screens.
- Extend `pnpm smoke:ui` to verify desktop and 662px-wide layouts.
- Ensure the smoke browser is closed even when layout assertions fail.

Success: the current narrow in-app browser keeps capture reachable without hiding session/review workflows.

### Slice 16: Chart Header Readout

Status: Done.

- Expand the selected-candle chart header readout.
- Include selected date, OHLC, volume, and candle percent change.
- Keep the readout constrained so it does not crush toolbar/header controls.

Success: selected-candle context is readable on-chart without shifting focus to the capture panel.

### Slice 17: Selected Candle Affordance

Status: Done.

- Add a stronger selected-candle vertical band on the price chart.
- Keep the replay cursor line visible inside the selected band.
- Add a right-side selected close price tag.
- Keep the affordance non-interactive so drawing and label controls still receive clicks.

Success: the selected candle is visually obvious while preserving chart interaction speed.

### Slice 18: Topbar Compression

Status: Done.

- Reduce topbar height, padding, and control chrome.
- Keep the brand visible without letting it dominate chart space.
- Tighten toolbar gaps and control sizing so charts start higher.

Success: the workstation reads more like a compact charting surface and less like a dashboard header.

### Slice 19: Narrow Chart Focus

Status: Done.

- Promote the existing SOXL/SOXS rail target into shared chart focus state.
- Keep desktop rendering both synchronized ticker charts.
- On narrow screens, show the focused ticker chart instead of stacking both charts behind the fixed capture drawer.
- Keep candle clicks, label focus, and drawing tools synced to the focused ticker.

Success: the current narrow in-app browser can use SOXL or SOXS as a focused chart surface without scrolling through both full indicator stacks.

### Slice 20: TradingView Indicator Fidelity

Status: Done.

- Move all indicator pane titles and latest values into TradingView-style plot overlays.
- Add colored inline values for Stoch RSI and CM WVF.
- Add right-side latest-value tags for indicator panes.
- Add the Stoch RSI 20-80 shaded band and dashed reference lines.
- Keep CM WVF visually aligned with the locked `22 20 2 50 0.85 40 14 3` configuration.
- Improve overlay label legibility over histogram and line plots.

Success: SMIO, Stoch RSI, CM WVF, and ATR read like TradingView lower panes while preserving the existing indicator snapshot data.

### Slice 21: Narrow Indicator Stack Fit

Status: Done.

- Compact the focused chart on narrow screens so the price pane plus SMIO, Stoch RSI, CM WVF, and ATR panes fit more like the TradingView reference.
- Reduce mobile indicator pane heights without changing desktop pane density.
- Reduce fixed capture drawer height on narrow screens so it does not cover the full lower indicator stack.
- Keep right-side indicator value tags readable at the compact size.

Success: the narrow Codex browser can see all four lower indicator panes above the capture drawer more consistently.

### Slice 22: Keyboard Capture Ergonomics

Status: Done.

- Keep one-key `E`, `X`, `S`, and `I` label capture for fast decision logging.
- When a label is open for editing, make `E`, `X`, `S`, and `I` change the edit label type instead of creating a second label.
- Add `Enter` to save an open label edit and `Esc` to cancel it.
- Add `Space` to toggle replay playback when replay mode can advance.
- Show compact hotkey badges on label type controls.

Success: keyboard-first capture remains fast while avoiding accidental duplicate labels during edit workflows.

### Slice 23: Multi-Timeframe Grid Foundation

Status: Done.

- Cache synchronized chart data for `1D`, `4H`, and `2H` in the frontend store.
- Render the desktop workstation as a 2x3 grid: SOXL/SOXS rows and 1D/4H/2H columns.
- Keep the existing focused ticker/timeframe behavior for narrow screens so the capture drawer remains usable.
- Carry selected-candle timeframe through label capture, label focus, and chart clicks.
- Keep labels and drawings scoped to the chart panel timeframe where they belong.
- In replay mode, hide future candles in every timeframe using the active replay timestamp as the boundary.

Success: EdgeLord now has the TradingView-style multi-timeframe grid foundation without breaking the fast single-chart narrow workflow.

### Slice 24: Chart Target Focus Sync

Status: Done.

- Make chart clicks promote that panel's ticker and timeframe into the active target.
- Keep narrow-screen focus aligned with the last interacted ticker/timeframe.
- Make drawing tools use and display the active target timeframe.
- Prevent drawing modes from appearing active on the same ticker but wrong timeframe.
- Keep label focus and candle navigation carrying timeframe context forward.

Success: interacting with any 1D, 4H, or 2H panel makes the rest of the workstation target that exact chart instead of silently staying on the previous timeframe.

### Slice 25: Rail Timeframe Target Controls

Status: Done.

- Add `1D`, `4H`, and `2H` target controls to the left drawing rail.
- Keep the rail's active timeframe in sync with the chart grid and drawing tools.
- Update drawing tool labels so the target ticker and timeframe are explicit.
- Use cached timeframe data when switching targets so the control stays fast after the initial load.

Success: narrow and keyboard-heavy workflows can retarget the focused chart timeframe directly from the rail without reaching for the top toolbar.

### Slice 26: All-Timeframe Toolbar Semantics

Status: Done.

- Rename the top toolbar timeframe selector contract to the focused chart timeframe.
- Keep the TradingView-like topbar timeframe affordance, but make it mirror the active chart target rather than imply single-timeframe data loading.
- Change the load button from active-timeframe-specific copy to `Load Charts`.
- Add toolbar coverage so the full-grid load action remains tied to `loadChartData`.

Success: the toolbar no longer suggests that EdgeLord is loading only one timeframe when the grid now hydrates 1D, 4H, and 2H together.

### Slice 27: Topbar Focused Symbol Target

Status: Done.

- Add a focused ticker selector to the top toolbar.
- Keep ticker targeting synced with the left rail so either surface can retarget the active chart.
- Keep the timeframe selector beside the ticker selector so the toolbar reads as symbol plus interval.
- Add toolbar coverage for focused ticker changes.

Success: the topbar now communicates the active chart target directly instead of starting with an unlabeled timeframe-only control.

### Slice 28: Single-Row Narrow Toolbar

Status: Done.

- Stop the toolbar controls from wrapping into multiple rows on narrow screens.
- Let the toolbar scroll horizontally when the viewport is too narrow for every control.
- Keep control groups intact so symbol/timeframe, replay, navigation, and export actions remain scannable.

Success: the narrow workstation preserves chart height by keeping the topbar as a single compact control strip.

### Slice 29: Compact Narrow Brand Row

Status: Done.

- Keep the brand and toolbar on the same row at narrow widths.
- Hide the brand subtitle on narrow screens.
- Reduce narrow topbar padding and brand mark size.
- Preserve horizontal toolbar overflow beside the brand.

Success: narrow screens get one compact TradingView-style header row instead of a separate brand row above the controls.

### Slice 30: Compact Narrow Drawing Rail

Status: Done.

- Reduce narrow drawing rail padding, gaps, and control heights.
- Keep ticker, timeframe, cursor, drawing, marker, and delete controls in the same horizontal strip.
- Preserve horizontal overflow so every drawing action remains reachable.

Success: the narrow workstation gives more vertical space back to the chart and indicator stack without removing any drawing tools.

### Slice 31: Narrow Secondary Panel Dock

Status: Done.

- Move collapsed session and review rows into a fixed mini dock above the capture drawer on narrow screens.
- Tighten secondary panel summary height and typography in the dock.
- Keep opened session/review details scroll-bounded so they do not consume the whole viewport.

Success: narrow screens no longer strand session/review rows in the main document gap between the chart and fixed capture drawer.

### Slice 32: Compact Narrow Capture Drawer

Status: Done.

- Reduce the narrow capture drawer height and internal padding.
- Tighten label, confidence, setup quality, and reasons controls while preserving tap targets.
- Drive capture drawer height and secondary dock offsets from the same mobile CSS variable.
- Keep bottom page padding aligned with the fixed capture and secondary dock stack.

Success: narrow screens retain the fast capture controls while giving more visible room back to the chart and indicator stack.

### Slice 33: Focused Chart Expansion

Status: Done.

- Add a grid/focused chart layout mode.
- Let the left rail expand the current ticker/timeframe target.
- Add a chart-header focus control so any panel can become the expanded chart directly.
- Keep the active ticker/timeframe synced when a chart panel is expanded.
- Preserve the existing narrow focused-chart behavior while giving desktop a larger drawing and labeling surface.

Success: the six-panel grid remains available, but the active chart can be expanded quickly for detailed drawing, indicator review, and label capture.

### Slice 34: Focused Layout Polish

Status: Done.

- Rebalanced focused desktop chart proportions so the price pane takes priority and indicator strips stay compact.
- Replaced the chart-header Focus/Grid text button with a compact chart-control icon while preserving accessible labels.
- Hid the less-important per-chart bar/close readout in expanded mode.
- Added a compact topbar badge showing which ticker/timeframe is currently isolated in focused layout.
- Covered the focused-layout scope badge and chart expansion behavior with web tests.

Success: focused mode reads as an intentional charting state, with a larger TradingView-style price surface and a clear topbar signal that the grid is filtered.

### Slice 35: Focused Mode Visual Pass

Status: Done.

- Verified focused mode in the running desktop web app with real SOXL/SOXS data.
- Fixed app-shell shrink behavior so resized browser windows do not force page-level horizontal overflow.
- Tightened focused indicator headers so long labels and values truncate before the right-side scale/value tags.
- Treated constrained-width checks as responsive web hygiene only; EdgeLord remains a desktop-first web workstation, not a mobile app.

Success: focused mode holds together visually in the desktop web app, and resized browser windows do not break the chart surface with page-level overflow.

### Slice 36: Focused Decision Capture Pass

Status: Done.

- Kept chart label markers selectable in focused chart layout and added a visible selected-marker state.
- Prevented the primary capture buttons from creating duplicate labels while an existing label is open for editing.
- Preserved edit controls for confidence, setup quality, reasons, and notes while the label editor is active.
- Added focused layout coverage for selecting chart label markers and capture-panel coverage for the edit-mode duplicate guard.

Success: focused mode supports the decision-capture loop without losing chart marker selection context or accidentally creating a second label during edits.

### Slice 37: Focused Capture Live Browser Pass

Status: Done.

- Extended the UI smoke harness with deterministic SOXL/SOXS chart data in its isolated SQLite database.
- Exercised the focused chart capture loop in a real browser: focus chart, select candle, create label, select chart marker, edit label type, save, and delete.
- Verified selected chart markers remain visible and the primary capture buttons are disabled while editing.
- Made the API CORS origin configurable with `WEB_ORIGIN` so isolated smoke runs can use non-default local web ports without weakening the default local allowlist.

Success: focused-mode decision capture is now covered against the running desktop web app through a repeatable local browser smoke.

### Slice 38: Capture History Density Pass

Status: Done.

- Tightened label history rows so the capture panel remains dense during focused chart work.
- Added a selected/current state to the active label history row, mirroring the selected chart marker state.
- Preserved the existing label edit flow while making the open label easier to identify in history.
- Covered the selected history row with component tests and kept the focused browser smoke as the workflow gate.

Success: focused capture now keeps chart marker selection and label history selection visually aligned without adding new workflow surface.

### Slice 39: Focused Capture Notes/Reasons Polish

Status: Done.

- Tightened the reasons/notes drawer copy and spacing so optional label detail stays secondary to fast capture.
- Added a compact detail summary that reflects selected reasons and notes without forcing the drawer open.
- Verified editing a saved label can update reason codes and notes while primary capture buttons remain disabled.
- Extended focused browser smoke coverage to export and assert edited label type, reason codes, and notes before deletion.

Success: focused capture detail editing now round-trips through the product without creating duplicate labels or crowding the chart-first workflow.

### Slice 40: Capture Edit Cancel/Reset Polish

Status: Done.

- Reset confidence, setup quality, reasons, notes, and edit label type when a label edit is canceled, saved, or deleted.
- Made `Esc` cancel label editing even when focus is inside the notes textarea.
- Covered canceling after changing type, confidence, reasons, and notes, then creating a fresh label with clean defaults.

Success: abandoned label edits no longer leak stale detail state into the next capture.

### Slice 41: Capture Status Feedback Polish

Status: Done.

- Replaced generic saved-label feedback with explicit created, updated, and deleted label status messages.
- Kept status feedback compact and non-modal in the capture panel.
- Extended component coverage and focused browser smoke coverage for status copy.
- Added `pnpm verify:focused-ui` plus a repo-local `focused-ui-verify` skill to run the repeated focused UI verification sequence in one step.

Success: capture feedback now clearly identifies the last label action without competing with chart work.

### Slice 42: Capture Status Lifecycle Polish

Status: Done.

- Cleared stale capture status when candle context changes, timeframe changes, replay steps, or label editing starts.
- Preserved fresh created, updated, and deleted status feedback after label actions.
- Covered status clearing with component and store tests.

Success: capture feedback now clears when context changes instead of lingering across unrelated capture work.

### Slice 43: Capture Keyboard Status Polish

Status: Done.

- Verified keyboard-created labels show the same created feedback as mouse capture.
- Verified label hotkeys plus `Enter` during edit show the same updated feedback as button saves without creating duplicate labels.
- Verified `Esc` cancel clears stale status and the next keyboard capture starts from clean default draft state.
- Added `pnpm workflow:focused-ui` as the single scan/edit/verify entrypoint for focused chart and capture UI loops.

Success: keyboard and mouse capture flows now share the same compact status lifecycle.

### Slice 44: Capture Status Error Polish

Status: Done.

- Cleared stale success feedback when label create/update/delete validation fails.
- Cleared stale success feedback when label create/update/delete API calls fail.
- Kept compact error feedback visible without old created/updated/deleted copy competing with it.
- Added focused store and component coverage for failure feedback.

Success: capture status now represents the latest label outcome, including failed attempts.

### Slice 45: Capture Button Busy State Polish

Status: Done.

- Added action-specific busy labels for save and delete while async edit operations are pending.
- Guarded save/delete handlers against duplicate submits beyond button disabled state.
- Covered repeated `Enter` while saving and repeated delete clicks while deleting.
- Updated the repo-local focused UI skill so scan, edit, and verify use `pnpm workflow:focused-ui` as the single entrypoint.

Success: capture edit actions now make pending state visible and resist accidental duplicate submits.

### Slice 46: Capture Editor Failure Retention Polish

Status: Done.

- Made `updateLabel` and `deleteLabel` return success/failure so UI callers can preserve edit context on failure.
- Kept failed saves in the editor with draft label type and notes intact.
- Kept failed deletes in the editor with controls re-enabled after error feedback appears.
- Recorded the preferred focused UI command sequence in the repo-local skill.

Success: failed edit operations no longer discard the user context needed to retry or cancel.

### Slice 47: Capture Error Recovery Polish

Status: Done.

- Covered retrying a failed save and confirming the successful retry closes the editor, clears the error, and shows updated feedback.
- Covered retrying a failed delete and confirming the successful retry closes the editor, clears the error, and shows deleted feedback.
- Added a small captured-label test helper for recovery scenarios.

Success: failed capture edit operations now have a covered recovery path.

### Slice 48: Capture Test Fixture Cleanup

Status: Done.

- Added a reusable session fixture helper for capture panel tests.
- Replaced repeated captured-label literals with the shared `tradeEvent()` helper.
- Kept the cleanup scoped to tests with no runtime behavior changes.

Success: focused capture tests are less noisy to extend for the next workflow polish slices.

### Slice 49: Capture Test Workflow Naming Polish

Status: Done.

- Added `pnpm test:focused-ui` as the named fast preflight for capture panel/store work.
- Updated the repo-local focused UI skill to use the named preflight in its preferred command sequence.
- Kept `pnpm workflow:focused-ui -- --verify` as the final focused UI gate.

Success: focused capture preflight no longer requires remembering the long filtered test command.

### Slice 50: Focused Workflow Script Preflight Polish

Status: Done.

- Made `pnpm workflow:focused-ui` print `pnpm test:focused-ui` as the fast preflight.
- Made the workflow script advertise `pnpm workflow:focused-ui -- --verify` as the final gate.
- Kept the script read-only unless `--verify` is passed.

Success: the focused workflow command now tells agents the complete scan, preflight, and verify sequence.

### Slice 51: Focused Workflow Docs Consistency Polish

Status: Done.

- Aligned the handoff verification defaults with the repo-local focused UI skill and workflow script output.
- Made the three-command focused UI loop explicit in the handoff: scan, preflight, final gate.
- Kept the slice docs/skill-only with no runtime behavior changes.

Success: the focused UI workflow is now described consistently in the command output, repo-local skill, handoff, and plan.

### Slice 52: Capture Label Helper Coverage Polish

Status: Done.

- Added an `openCapturedLabel()` helper for the repeated create-and-open setup in capture panel tests.
- Applied it only where opening the label is incidental setup for edit/save/delete behavior.
- Kept capture/open behavior tests explicit.

Success: capture panel tests now have less repeated setup without hiding the behavior under test.

### Slice 53: Capture Test Helper Scope Polish

Status: Done.

- Renamed capture panel test helpers to `capturedLabel`, `captureSession`, and `createAndOpenCapturedLabel`.
- Kept helpers local to the capture panel test file.
- Preserved explicit tests where capture/open behavior is the subject.

Success: helper names now describe capture-panel intent instead of generic fixture mechanics.

### Slice 54: Capture Test Setup Boundary Polish

Status: Done.

- Extracted default synchronized chart data into `capturePanelSyncData()`.
- Extracted default review summary data into `captureReviewSummary()`.
- Kept per-test behavior overrides inline so the assertions remain readable.

Success: capture panel tests now separate stable setup data from behavior-specific test intent.

### Slice 55: Basic Chart Navigation Polish

Status: Done.

- Removed the old yellow selected-candle vertical band/cursor overlay.
- Added standard hover crosshair lines on the chart surface.
- Enabled native wheel zoom, drag pan, touch drag, and pinch scaling through Lightweight Charts.
- Let the chart surface receive navigation gestures by disabling pointer interception from transparent candle hit targets.
- Added a compact `Fit` reset control per chart.

Success: basic chart navigation now supports crosshair hover, zoom, pan, and reset without full TradingView scope.

### Slice 56: Hover OHLC And Indicator Readout Polish

Status: Done.

- Updated the chart header readout to follow the hovered candle/crosshair position.
- Extended the hover crosshair into each indicator pane with synchronized vertical guide lines.
- Updated SMIO, Stoch RSI, CM WVF, and ATR indicator header values from the hovered bar.
- Kept click selection and capture behavior intact.

Success: chart hover now gives immediate OHLC/date plus per-indicator values for the active bar.

### Slice 57: Crosshair Precision And Range Memory Polish

Status: Done.

- Changed hover-to-candle mapping to stable candle buckets, with focused coverage for boundary behavior.
- Centered indicator-pane crosshair guides on the hovered candle bucket.
- Remembered Lightweight Charts visible logical ranges per ticker/timeframe.
- Made `Fit` reset both the visible chart range and the remembered range for that chart.
- Tightened the focused UI workflow skill around the one-command verification closeout.

Success: chart navigation now keeps zoom/pan intent per panel and hover readouts align more predictably with candle buckets.

### Slice 58: Chart Keyboard Navigation Polish

Status: Done.

- Made arrow-key candle review start from the focused ticker/timeframe when no candle is selected.
- Routed toolbar `Prev`/`Next` through the same focused chart target behavior.
- Preserved capture shortcuts and input-field key guards.

Success: keyboard review now follows the chart the user is focused on instead of defaulting to the first ticker.

### Slice 59: Selected Bar Visibility Polish

Status: Done.

- Added a small selected-candle close-price dot and bottom tick marker.
- Kept the selected marker separate from the hover crosshair.
- Kept the old full-height selected vertical band removed.

Success: keyboard-selected bars are now easier to locate without adding back the distracting vertical selection band.

### Slice 60: Focused Chart Review Loop Polish

Status: Done.

- Split chart header readout into distinct hover and selected/capture contexts.
- Kept the selected readout visible while hovering another bar after keyboard selection.
- Added visual tone separation: green for hover, yellow for selected.

Success: mouse hover, keyboard selection, and capture context now read as separate states instead of overwriting each other in the header.

### Slice 61: Narrow Header Readout Fit Polish

Status: Done.

- Added explicit shrink priority for hover and selected chart header readouts.
- Hid the redundant chart bar-count state in narrow layouts.
- Kept header readouts to one truncating row so controls do not get pushed out.

Success: the two-readout header is less likely to crowd or overlap controls in dense and narrow layouts.

### Slice 62: Focused Chart Mobile Smoke Polish

Status: Done.

- Added a narrow focused chart review path to the Playwright smoke harness.
- Verified focused SOXL 4H candle selection, hover readout, and selected readout together at 662px width.
- Asserted the narrow chart readouts do not overlap the focused chart control.

Success: the narrow focused chart header/readout path is now covered by automated smoke.

### Slice 63: Focused Review Interaction Smoke Polish

Status: Done.

- Extended the narrow focused chart smoke path through keyboard arrow review.
- Verified selected marker, capture context, and selected header readout stay synchronized after keyboard navigation.
- Verified the `E` hotkey creates an `ENTRY` label from focused chart review.

Success: the focused review loop is now smoke-covered across mouse hover, keyboard navigation, and capture hotkey paths.

### Slice 64: Capture Hotkey Feedback Polish

Status: Done.

- Added compact label detail to capture success feedback.
- Kept the existing status text while appending label type, ticker, price, and timeframe.
- Styled capture status as a compact success badge that fits the narrow drawer.

Success: hotkey capture now gives clearer immediate feedback without adding vertical bulk.

### Slice 65: Capture Drawer Status Smoke Polish

Status: Done.

- Extended narrow focused smoke to verify compact capture feedback after the `E` hotkey.
- Asserted status detail includes label type, ticker, price, and timeframe.
- Asserted status height stays compact in the narrow capture drawer.

Success: hotkey capture feedback is now smoke-covered in the narrow focused workflow.

### Slice 66: Capture Drawer Status Error Polish

Status: Done.

- Changed capture errors to the same compact two-part status layout as success.
- Added alert semantics with an `Error` label and truncating message text.
- Covered save/delete error alert rendering in focused capture tests.

Success: success and error capture statuses now share a compact structure while preserving error urgency.

### Slice 67: Status Feedback Smoke Coverage Polish

Status: Done.

- Added browser smoke coverage for the compact capture delete-error alert.
- Injected a one-time failed label delete request during the focused capture workflow.
- Verified the error alert text, compact height, and editor retention before retrying the real delete.

Success: capture status success and error feedback are now both covered at the browser smoke layer.

### Slice 68: Export Contract And Version Manifest

Status: Done.

- Add central constants for schema/export/indicator/structure calculation versions.
- Add export manifest metadata to the export surface.
- Include version fields in JSON and CSV exports.
- Test that version metadata is present and stable.

Success: exports have a stable versioned contract before fields are widened.

### Slice 69: Label Leakage Metadata

Status: Done.

- Persist/default `decisionPhase`, `captureMode`, `visibleUntilTimestamp`, `potentialVisualLeakage`, and `selectedBarIndex`.
- Mark regular-mode labels as visually leakage-prone.
- Export these fields in CSV/JSON.

Success: every decision row declares what market data was visible when it was captured.

### Slice 70: Linkage And Intent Fields

Status: Done.

- Add optional `setupId`, `tradeId`, `parentLabelId`, `decisionRole`, bias, direction, instrument-role, paired-role, entry/exit-style, invalidation, and target fields.
- Use conservative defaults and compact editor controls.
- Export the fields without building a full lifecycle workspace yet.

Success: labels can become setup/trade examples instead of loose candle annotations.

### Slice 71: Multi-Timeframe Context Snapshot

Status: Done.

- Capture `d1`, `h4`, and `h2` context at label time using the last fully closed candle at or before the visible decision timestamp.
- Store staleness fields and export prefixed context columns.
- Keep raw multi-timeframe context nested in JSON.

Success: each decision row carries aligned multi-timeframe context without future leakage.

### Slice 72: Derived Decision Feature Columns

Status: Done.

- Add selected candle shape features, trend/location flags, ATR-normalized distances, indicator state flags, and recent structure/rank fields.
- Keep these as decision features only.

Success: visual setup information becomes model-friendly without adding outcome leakage.

### Slice 73: Paired ETF And Ratio Features

Status: Done.

- Add aligned SOXL/SOXS paired feature fields.
- Add ratio and divergence features.
- Add explicit missing-paired-context flags.

Success: inverse ETF context becomes explicit and testable instead of inferred from ticker names.

### Slice 74: Export Validation Report

Status: Done.

- Add validation checks for selected candles, timestamps, paired/multi-timeframe alignment, leakage warnings, indicator/structure presence, drawing references, label validity, and row counts.
- Return summary counts and issue lists.

Success: dataset quality is visible before exports are trusted for strategy work.

### Slice 75: Dataset Health Summary UI

Status: Done.

- Surface compact validation/health counts in the review/export area.
- Show labels by ticker/timeframe/type/mode plus missing-context and leakage counts.

Success: the workstation shows whether the current label set is usable without becoming an analytics dashboard.

### Slice 76: Grid Scanner Simplification

Status: Done.

- Collapse detailed indicator panes by default in grid mode.
- Replace them with compact indicator badges/state strips.
- Preserve full indicator detail in focused mode.

Success: grid mode becomes a scanner instead of the primary dense labeling surface.

### Slice 77: Capture Panel Empty-State Utility

Status: Done.

- Show current target, hotkeys, active session count, last label, optional undo/delete-last, and compact history when no candle is selected.

Success: the capture panel remains useful before a candle is selected.

### Slice 78: Toolbar Zone Cleanup

Status: Done.

- Group toolbar controls into market, replay, nav, session, and export zones.
- De-emphasize export controls during active labeling.

Success: the toolbar reads as an operational charting surface instead of a prototype control strip.

### Slice 79: Narrow Compact Label Bar

Status: Done.

- Replace bulky narrow capture state with a compact sticky label bar.
- Expand details only when needed.

Success: narrow layouts preserve chart review space while keeping capture controls reachable.

### Slice 80: Setup/Trade Lifecycle Foundation

Status: Done.

- Add minimal setup/trade linkage fields to labels, persistence, validation, and exports.
- Keep capture UI compact and avoid a new strategy-mining workspace.

Success: candle-level labels can be grouped into setup/trade examples without changing the one-row-per-decision export shape.

### Slice 81: Lifecycle Review Summary

Status: Done.

- Add compact QA counts for decision role, bias, trade direction, setup ID coverage, and trade ID coverage.
- Surface lifecycle coverage in the review panel without adding strategy-mining or backtesting.

Success: setup/trade metadata quality is visible while labeling.

### Slice 82: Setup/Trade Lifecycle Workspace

Status: Done.

- Add compact controls to start or continue a setup/trade idea.
- Let labels reuse setup/trade IDs without typing them every time.
- Keep lifecycle roles explicit while preserving the one-row-per-decision export shape.

Success: grouped setup/trade examples can be captured quickly without starting strategy mining.

### Slice 83: Outcome Evaluator Foundation

Status: Done.

- Add namespaced optional outcome fields for future return, MFE, MAE, target/stop hit, and bars-to-hit.
- Keep outcomes evaluation-only and excluded from ordinary decision features by default.

Success: outcome plumbing exists without leaking future data into training features.

### Slice 84: Outcome QA Review Surface

Status: Done.

- Surface outcome coverage in the review/export health panel.
- Make the evaluation-only and CSV-excluded status visible.
- Keep this informational only; do not compute outcomes or add backtesting.

Success: outcome dataset coverage is visible before any outcome calculation or rule mining starts.

### Slice 85: Outcome Calculation Service

Status: Done.

- Calculate evaluation-only outcomes for labels from future same ticker/timeframe candles.
- Persist future returns, MFE/MAE, target/stop hit, and bars-to-hit into `outcome_*` fields.
- Keep outcomes out of decision CSV by default.

Success: labels can be enriched with deterministic outcomes without creating a backtesting engine.

### Slice 86: Outcome Calculation UI Action

Status: Done.

- Add a compact action to calculate outcomes for the selected or latest label.
- Refresh review/export validation after calculation.
- Keep the control explicit and label-level.

Success: outcome enrichment is usable from the workstation without becoming a backtest surface.

## Build Order

1. Lightweight price chart.
2. Workstation shell and left tool rail.
3. Drawing overlay V2.
4. Indicator pane V2.
5. Label marker V2.
6. Replay polish.
7. Review extraction surface.
8. Export hardening.
9. Workstation export controls.
10. Right rail cleanup.
11. Smoke verification harness.
12. Export state correctness.
13. Isolated smoke data.
14. Inspector secondary panels.
15. Responsive inspector smoke.
16. Chart header readout.
17. Selected candle affordance.
18. Topbar compression.
19. Narrow chart focus.
20. TradingView indicator fidelity.
21. Narrow indicator stack fit.
22. Keyboard capture ergonomics.
23. Multi-timeframe grid foundation.
24. Chart target focus sync.
25. Rail timeframe target controls.
26. All-timeframe toolbar semantics.
27. Topbar focused symbol target.
28. Single-row narrow toolbar.
29. Compact narrow brand row.
30. Compact narrow drawing rail.
31. Narrow secondary panel dock.
32. Compact narrow capture drawer.
33. Focused chart expansion.
34. Focused layout polish.
35. Focused mode visual pass.
36. Focused decision capture pass.
37. Focused capture live browser pass.
38. Capture history density pass.
39. Focused capture notes/reasons polish.
40. Capture edit cancel/reset polish.
41. Capture status feedback polish.
42. Capture status lifecycle polish.
43. Capture keyboard status polish.
44. Capture status error polish.
45. Capture button busy state polish.
46. Capture editor failure retention polish.
47. Capture error recovery polish.
48. Capture test fixture cleanup.
49. Capture test workflow naming polish.
50. Focused workflow script preflight polish.
51. Focused workflow docs consistency polish.
52. Capture label helper coverage polish.
53. Capture test helper scope polish.
54. Capture test setup boundary polish.
55. Basic chart navigation polish.
56. Hover OHLC and indicator readout polish.
57. Crosshair precision and range memory polish.
58. Chart keyboard navigation polish.
59. Selected bar visibility polish.
60. Focused chart review loop polish.
61. Narrow header readout fit polish.
62. Focused chart mobile smoke polish.
63. Focused review interaction smoke polish.
64. Capture hotkey feedback polish.
65. Capture drawer status smoke polish.
66. Capture drawer status error polish.
67. Status feedback smoke coverage polish.
68. Export contract and version manifest.
69. Label leakage metadata.
70. Linkage and intent fields.
71. Multi-timeframe context snapshot.
72. Derived decision feature columns.
73. Paired ETF and ratio features.
74. Export validation report.
75. Dataset health summary UI.
76. Grid scanner simplification.
77. Capture panel empty-state utility.
78. Toolbar zone cleanup.
79. Narrow compact label bar.
80. Setup/trade lifecycle foundation.
81. Lifecycle review summary.
82. Setup/trade lifecycle workspace.
83. Outcome evaluator foundation.
84. Outcome QA review surface.
85. Outcome calculation service.
86. Outcome calculation UI action.
87. Label QA review mode.
88. Session gating UX.
89. Review panel reachability.
90. Replay date input cleanup.
91. Data quality / adjustment warning.
92. Drawing tool feedback.
