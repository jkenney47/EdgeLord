# EdgeLord Design Spec

## Goal

EdgeLord is a local-first trading replay and decision-capture web app for turning discretionary SOXL/SOXS trading behavior into structured, machine-readable data.

It is not a broker, live trading platform, prediction engine, or ML system. Its job is to make chart review fast, preserve the chart context around each decision, and export clean data for later strategy extraction and backtesting.

## Product Stance

EdgeLord has two chart modes:

- **Replay mode:** future candles are hidden after the current replay point. The user can step forward candle by candle, play/pause, and adjust replay speed.
- **Regular mode:** all loaded data is visible for normal research and annotation.

Labels are allowed in either mode and are treated as one dataset. EdgeLord will not distinguish replay labels from regular-mode labels in the main data model or exports. The app should still make replay mode mechanically safe by hiding future candles while replay is active.

Labels may be applied to any visible candle, including older visible candles. This is intentional for the user's workflow.

## Recommended Architecture

Use a local web app:

- Frontend: React, TypeScript, Vite
- Charting: TradingView Lightweight Charts
- State: Zustand
- Backend: Node.js, TypeScript, Fastify
- Database: SQLite
- Data access: provider adapter interface, Alpaca implementation first
- Indicators: local deterministic TypeScript calculations

The app runs on the user's Mac and opens in the browser. It is local-first, not hosted. Future desktop packaging can be considered after the replay/capture loop works.

## Milestone Strategy

Build in milestones:

1. **SOXL/SOXS 4H vertical slice:** market data import, aggregation, indicator calculations, synchronized two-chart replay, labels, trendlines, export.
2. **Full 2x3 chart grid:** SOXL/SOXS rows and 1D/4H/2H columns, all synchronized.
3. **Review dashboard:** entries, exits, skips, invalids, inferred entry/exit pairs, returns, distributions, and condition summaries.

This avoids implementing six broken chart surfaces before the data and replay engine are proven.

## Market Data

Use Alpaca first because it is the lowest-friction v1 source. Keep the provider behind a `MarketDataProvider` interface so Polygon/Massive or Databento can replace it later.

V1 imports SOXL and SOXS data for 2024-2026 only, expandable later.

EdgeLord should fetch base bars, not rely on vendor-provided 2H/4H/1D bars.

Preferred base timeframe:

- 1-minute bars when available
- 5-minute bars acceptable as fallback

Aggregation rules:

- Timezone: `America/New_York`
- Regular trading hours only: 9:30-16:00 ET
- Aggregation resets each trading day at 9:30 ET
- Candles must never span trading days
- Emit only completed candles
- 2H = 120 minutes from the session open
- 4H = 240 minutes from the session open
- 1D = full regular trading session

After aggregation, SOXL and SOXS must align by candle timestamp for each timeframe. The replay engine steps both tickers forward in lockstep.

Data validation must check:

- Expected trading-session bar coverage
- No duplicate timestamps
- No cross-day aggregated candles
- OHLC correctness from source bars
- Volume sum correctness
- SOXL/SOXS timestamp alignment after aggregation

## Chart Experience

The eventual main cockpit is a dense 2x3 grid:

- Rows: SOXL, SOXS
- Columns: 1D, 4H, 2H

The first milestone implements SOXL/SOXS 4H only.

Replay controls:

- Start from selected historical date
- Play/pause
- Step forward
- Adjustable speed
- No arbitrary forward jump in replay mode
- Regular mode can show all loaded candles

Charts should prioritize speed and information density over visual polish. Dark mode is required.

## Indicator Stack

Visual indicators are required because the user relies on them to make decisions.

Every chart should eventually display:

- Candles
- Volume 20
- EMA 25 close
- SMA 100 close
- Monthly VWAP
- SMIO with `long=20`, `short=20`, `signal=10`
- Stoch RSI with the user's TradingView-style configuration label `7 10 14 15`
- CM_WVF_V3_Ult with the user's settings
- ATR 14 RMA

CM_WVF_V3_Ult settings:

- `pd=22`
- `bbl=20`
- `mult=2`
- `lb=50`
- `ph=0.85`
- `sbc=false`
- `sbcc=false`
- `sbcFilt=true`
- `sbcAggr=false`
- `sgb=true`
- `ltLB=40`
- `mtLB=14`
- `str=3`
- `swvf=true`

SMIO formula:

```text
erg = TSI(close, short=20, long=20)
sig = EMA(erg, signal=10)
osc = erg - sig
```

CM_WVF formula:

```text
wvf = ((highest(close, pd) - low) / highest(close, pd)) * 100
sDev = mult * stdev(wvf, bbl)
midLine = sma(wvf, bbl)
upperBand = midLine + sDev
rangeHigh = highest(wvf, lb) * ph
filtered = ((wvf[1] >= upperBand[1] or wvf[1] >= rangeHigh[1]) and (wvf < upperBand and wvf < rangeHigh))
alert1 = wvf >= upperBand or wvf >= rangeHigh
alert2 = filtered
alert3 = upRange and close > close[str] and (close < close[ltLB] or close < close[mtLB]) and filtered
alert4 = upRange_Aggr and close > close[str] and (close < close[ltLB] or close < close[mtLB]) and filtered_Aggr
plot = -wvf
```

The app should store indicator values in snapshots even when the visual chart only renders a subset of values.

## Decision Capture

Supported label types:

- `ENTRY`
- `EXIT`
- `SKIP`
- `INVALID`

Label capture should be keyboard-first with visible UI controls:

- `E`: open capture panel as Entry
- `X`: open capture panel as Exit
- `S`: open capture panel as Skip
- `I`: open capture panel as Invalid
- `Enter`: save
- `Esc`: cancel

The capture panel should also have clickable buttons for label type, confidence, setup quality, and reason codes.

Required structured fields:

- `labelType`
- `ticker`
- `timestamp`
- `price`
- `confidence` from 1-5
- `setupQuality` from 1-5
- `reasonCodes[]`

Reason codes:

- `trendline_break`
- `stoch_rsi_condition`
- `ema_alignment`
- `volatility_expansion`
- `inverse_etf_confirmation`
- `other`

`other` can include a note. Notes are optional.

Labels are freeform. V1 does not enforce position state. Entry/exit pairing is inferred later in the review dashboard.

## Drawing Tools

V1 includes trendlines because they affect the trading decision.

Supported drawing objects:

- Trendlines
- Horizontal levels
- Breakout candle markers

Trendline requirements:

- Two-click creation
- Persisted anchors
- Editable or removable
- Slope calculated from anchors
- Age in candles calculated at label time
- Distance from selected candle price to nearest trendline calculated at label time
- Breakout flag calculated at label time

Drawing edits should update the visible drawing state and create audit records.

## Context Snapshots

On every label save, compute and store:

Indicator snapshot:

- ATR 14 RMA
- Stoch RSI values
- EMA 25
- SMA 100
- Monthly VWAP
- SMIO values
- CM_WVF values and alert states
- Distance from price to EMA/SMA/VWAP values
- Volume and volume average

Structure snapshot:

- Last 10 and 20 candle highs/lows
- Distance to recent high
- Distance to recent low
- Range compression/expansion metrics

Drawing context:

- Nearest trendline
- Trendline distance
- Trendline breakout flag
- Horizontal level distance
- Breakout marker state

Cross-ticker context:

- Paired ETF timestamp
- Paired ETF OHLCV
- Paired ETF indicator state

Snapshots must be computed only from candles available at the selected timestamp. No indicator calculation may read future bars.

## Storage Model

Use SQLite with current-state tables plus an invisible audit log.

The UI should show latest current state. Edits update current records. Every create/update/delete writes an audit record with before/after JSON. No edit reason is required.

Default exports use current records only. A later export option can include audit history if useful.

Core entities:

- `sessions`
- `base_bars`
- `aggregated_bars`
- `indicator_values`
- `drawings`
- `trade_events`
- `audit_log`
- `import_runs`

Trade event fields:

- `id`
- `sessionId`
- `timestamp`
- `ticker`
- `timeframe`
- `labelType`
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

## Session Management

Sessions group labels and replay work.

Each session has:

- `id`
- `name`
- `startTime`
- `endTime`
- `tickerFocus`
- `timeframeFocus`
- optional notes

The user can:

- Start a new session
- Resume a session
- Review past sessions

Every trade event links to a `sessionId`.

## Exports

V1 exports:

- JSON full current-state export
- CSV flattened trade event export

CSV should flatten important snapshot fields such as indicator values, reason codes, drawing distances, and paired ETF values.

## Review Dashboard

The dashboard should show:

- Counts by label type
- Entries, exits, skips, invalids
- Inferred entry/exit pairs
- Win rate
- Average return
- Distribution by confidence
- Distribution by setup quality
- Indicator values at entry
- Common conditions before profitable trades
- Conditions in skipped trades
- Loss clusters

V1 can keep inference simple: sort events by ticker and timestamp, pair each entry with the next exit for the same ticker.

## Non-Goals

V1 does not include:

- Live trading
- Broker integration
- ML
- Predictions
- Cloud sync
- Screenshot capture on labels
- Desktop app packaging

## Success Criteria

V1 is successful when:

- SOXL/SOXS 4H data imports for 2024-2026
- Aggregation and indicator calculations are replay-safe
- SOXL/SOXS replay in lockstep
- The user can create and edit labels quickly
- Trendlines persist and appear in label snapshots
- JSON and CSV exports contain clean current-state label data
- The app remains responsive enough to support 50-100 decisions per session
