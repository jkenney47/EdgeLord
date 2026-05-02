# ChatGPT Pro Consultant Packet: EdgeLord UX, Infrastructure, And Strategy Logic

You are acting as an outside product, UX, trading-workflow, data-infrastructure, and technical planning consultant for a local-first trading review app.

## Project Context

- Project/product: EdgeLord, a local-first desktop web app for TradingView-style replay review with structured decision capture.
- Target user: one discretionary trader reviewing SOXL/SOXS semiconductor ETF setups across multiple timeframes and converting visual decisions into a quantitative dataset for later strategy extraction and backtesting.
- Current product direction: do not build a full TradingView clone. Build a fast chart-review workstation where visual actions produce structured trade labels and exportable training data.
- Stack/runtime: React/Vite web app, Fastify API, SQLite local persistence, Zustand state, `lightweight-charts`, Alpaca import path, local CSV/JSON exports.
- Current source of truth: local project docs and code remain authoritative. Treat your answer as advisory; Codex will reconcile it against the repo.

## Visual Artifacts To Review

Please review these screenshots as the current UI state:

1. `desktop-grid.png`: six-panel synchronized chart grid, SOXL/SOXS by `1D`, `4H`, and `2H`.
2. `focused-soxl-4h.png`: focused chart mode for SOXL 4H with right capture panel.
3. `narrow-focused-soxl-4h.png`: narrow/browser fallback layout.

## Current Implementation Summary

Implemented:

- React/Vite web app plus Fastify API.
- Local SQLite-backed sessions, drawings, labels, review summaries, and exports.
- Alpaca market-data import path.
- SOXL/SOXS synchronized chart data for `1D`, `4H`, and `2H`.
- Multi-timeframe desktop grid: SOXL/SOXS rows by `1D`, `4H`, `2H` columns.
- Focused chart mode: expand active ticker/timeframe panel, then restore grid.
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
  - optional reasons and notes
- Indicator panes:
  - SMIO `20 20 10`
  - Stoch RSI `7 10 14 15`
  - CM WVF locked to `22 20 2 50 0.85 40 14 3`
  - ATR `14 RMA`
- Export:
  - JSON full export
  - flattened CSV export
  - toolbar export controls

## Current Captured Trade Label Shape

Each label is a structured `TradeEvent` row:

- `sessionId`
- `timestamp`
- `ticker`
- `timeframe`
- `labelType`: `ENTRY`, `EXIT`, `SKIP`, `INVALID`
- `price`
- `confidence`
- `setupQuality`
- `reasonCodes`
- `notes`
- `indicatorSnapshot`
- `structureSnapshot`
- `drawingContext`
- `createdAt`
- `updatedAt`

At label time the app currently captures:

- selected candle OHLCV
- same-timeframe indicator state for selected ticker
- paired ticker same-timestamp candle/indicator state
- recent 20-candle structure context:
  - recent high
  - recent low
  - distance to recent high
  - distance to recent low
  - recent candle highs/lows
- drawing context:
  - nearest trendline and distance
  - nearest horizontal level and distance
  - breakout marker on the same candle

CSV export currently flattens columns including:

- label metadata
- selected indicator values and distance-to-average fields
- paired ETF values
- recent structure values
- drawing-distance fields

## Current Near-Term Plan

Next planned slice:

**Trading Dataset Export Shape Polish**

Goal: review the flattened CSV/JSON trade export fields against the actual algorithm-training dataset goal. Add only missing fields that are already captured or cheap to capture. Do not start strategy mining or backtesting yet.

## Questions

Please be direct and skeptical.

1. Product direction:
   - Is the current direction correct: visual chart-review UI plus structured dataset underneath, rather than spreadsheet-only labeling or a full TradingView clone?
   - What should be cut, simplified, or emphasized?

2. Visual UX:
   - Based on the screenshots, what are the top visual or interaction problems that would slow a trader down?
   - Does the layout feel like a serious trading workstation or still too much like a prototype/dashboard?
   - What 3-5 UI improvements would most improve high-volume replay labeling without adding clutter?

3. Capture workflow:
   - Are `ENTRY`, `EXIT`, `SKIP`, `INVALID`, confidence, setup quality, reason codes, notes, indicator snapshot, structure snapshot, and drawing context the right primitive labels?
   - What label fields are missing if the goal is to infer rules later?
   - Should labels be candle-level only, trade-pair-level, setup-level, or all three?

4. Dataset/export shape:
   - What columns should the flattened CSV definitely include before strategy extraction begins?
   - What fields should remain JSON/nested rather than flattened?
   - How should multi-timeframe context be represented? For example, daily context plus 4H setup plus 2H trigger.
   - How should future leakage be avoided in replay labels and exports?

5. Architecture and logic:
   - Is the current local-first architecture sensible for this stage?
   - What persistence or data-model choices could become painful later?
   - What should be normalized now versus left as snapshots?
   - What validation should be added before trusting the dataset?

6. Implementation sequencing:
   - What is the smallest credible next implementation slice?
   - What should be deferred until after the dataset shape is explicit?
   - What would a more ambitious but still credible v2 look like?

## Return Format

Return:

- concise recommendation
- top UX findings
- top data/logic findings
- accepted next implementation slice
- suggested dataset/export fields
- risks and failure modes
- validation checks
- what to reject or defer

Include sources or benchmark references only if you use external knowledge. Do not recommend sending secrets, private financial account data, credentials, or raw personal trading/account data to third-party services.
