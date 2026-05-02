You are reviewing EdgeLord, a local-first trading review and labeling workstation.

Product thesis:
EdgeLord should not become a full TradingView clone. It should be a fast discretionary review tool that turns visual chart review into clean structured decision data for later strategy analysis. The target workflow is SOXL/SOXS multi-timeframe review, replay/simulation, labeling entries/exits/skips/invalidations, and exporting trustworthy datasets.

Current app state shown in screenshots:
- Attach only the files named `01-edgelord-grid-workstation.png`, `02-edgelord-focused-chart-label-pins.png`, `03-edgelord-pan-mode.png`, and `04-edgelord-hover-readouts.png`.
- Multi-timeframe SOXL/SOXS chart workspace.
- Focused chart mode and chart grid mode.
- Cursor and Pan interaction modes.
- Label pins for saved ENTRY labels, with compact badges.
- Synchronized hover/readout behavior for candles and indicators.
- Review panel with dataset health, leakage warnings, intent gaps, setup/trade coverage, and research readiness.
- Capture panel for creating and editing structured labels.

Please assess the screenshots and produce a practical development plan.

Focus on:
1. Visual UX:
   - Does the chart workspace feel usable for high-volume labeling?
   - Are label pins, selected candle markers, crosshair/readouts, tool rail, review panel, and capture panel clear?
   - What should be simplified, hidden, resized, or moved?

2. Chart interaction model:
   - Are Cursor/Pan/Draw modes enough?
   - What basic TradingView-style navigation behaviors are still missing?
   - What should be explicitly avoided to prevent building a TradingView clone?

3. Labeling workflow:
   - Does the app make it obvious what candle is being labeled?
   - Does it make it easy to label fast without losing context?
   - What should happen after a label is created, selected, edited, or reviewed?

4. Dataset trust:
   - Are the review/validation surfaces showing the right concepts?
   - What QA issues should be prioritized next?
   - How should leakage warnings, setup/trade linkage, replay coverage, and outcome availability be represented?

5. Implementation sequencing:
   - Give a one-by-one development plan with small slices.
   - For each slice, include goal, user-visible change, data/logic change if any, and acceptance criteria.
   - Separate must-do next work from later/deferred work.

Constraints:
- Local-first app.
- No broker integration yet.
- No automated strategy mining yet.
- No additional indicators unless clearly necessary.
- Prefer fewer, sharper UI elements over more TradingView-like controls.
- The next work should improve labeling speed and dataset trust, not visual decoration.

Return:
- Concise diagnosis.
- Ordered implementation plan.
- Specific UI/logic recommendations.
- Things to reject/defer.
