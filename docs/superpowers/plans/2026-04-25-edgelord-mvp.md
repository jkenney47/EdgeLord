# EdgeLord MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working EdgeLord vertical slice: local SOXL/SOXS 4H replay, visual indicators, editable labels, trendlines, SQLite storage, and export.

**Architecture:** A local React/Vite frontend talks to a local Node/Fastify API backed by SQLite. Market data enters through a provider adapter, with Alpaca as the first implementation and all replay, aggregation, indicators, labels, drawings, audit, and exports kept local.

**Tech Stack:** React, TypeScript, Vite, Zustand, TradingView Lightweight Charts, Node.js, Fastify, SQLite, Kysely or Drizzle, Vitest, Playwright.

---

## Scope

This plan implements the first useful MVP, not the full final product.

Included:

- Local web app scaffold
- SQLite schema and migrations
- Alpaca-backed 2024-2026 SOXL/SOXS import
- RTH-only 4H aggregation
- Indicator engine for the required visual stack
- Two synchronized 4H charts: SOXL and SOXS
- Replay and regular chart modes
- Labels allowed at any time on visible candles
- Keyboard-first capture panel with clickable controls
- Editable current label records
- Invisible audit log
- Trendlines and horizontal levels
- JSON and CSV export

Deferred:

- Full 2x3 chart grid
- 2H and 1D expansion
- Review dashboard
- Desktop app packaging
- Screenshot capture
- Cloud sync

## File Structure

Create the project as a monorepo-style TypeScript app:

```text
package.json
pnpm-workspace.yaml
tsconfig.base.json
.env.example
apps/api/
  package.json
  tsconfig.json
  src/server.ts
  src/config/env.ts
  src/db/database.ts
  src/db/schema.ts
  src/db/migrate.ts
  src/market-data/types.ts
  src/market-data/alpacaProvider.ts
  src/market-data/importService.ts
  src/aggregation/rthCalendar.ts
  src/aggregation/aggregateBars.ts
  src/indicators/series.ts
  src/indicators/indicatorEngine.ts
  src/labels/labelService.ts
  src/drawings/drawingService.ts
  src/exports/exportService.ts
  src/routes/*.ts
  tests/*.test.ts
apps/web/
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  src/main.tsx
  src/App.tsx
  src/api/client.ts
  src/store/useAppStore.ts
  src/charts/ReplayChart.tsx
  src/charts/ChartGrid4H.tsx
  src/charts/indicatorPanes.ts
  src/components/ReplayToolbar.tsx
  src/components/CapturePanel.tsx
  src/components/SessionPanel.tsx
  src/components/ExportPanel.tsx
  src/drawings/drawingTools.ts
  src/styles.css
```

## Phase 1: Project Bootstrap

### Task 1: Initialize Tooling

**Files:**

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.env.example`
- Create: `apps/api/package.json`
- Create: `apps/web/package.json`

- [ ] Create a pnpm workspace with `apps/api` and `apps/web`.
- [ ] Add scripts:
  - `dev`: run API and web together
  - `dev:api`
  - `dev:web`
  - `test`
  - `typecheck`
  - `lint`
- [ ] Install runtime dependencies:
  - API: `fastify`, `better-sqlite3`, `kysely` or `drizzle-orm`, `zod`, `date-fns`, `date-fns-tz`, `dotenv`, `nanoid`
  - Web: `@vitejs/plugin-react`, `vite`, `react`, `react-dom`, `zustand`, `lightweight-charts`
- [ ] Install dev dependencies:
  - `typescript`, `tsx`, `vitest`, `eslint`, `prettier`, `concurrently`, `playwright`
- [ ] Create `.env.example`:

```bash
ALPACA_API_KEY_ID=
ALPACA_API_SECRET_KEY=
DATABASE_PATH=./data/edgelord.sqlite
API_PORT=4317
WEB_PORT=5173
```

- [ ] Verify:

```bash
pnpm install
pnpm typecheck
pnpm test
```

Expected: install succeeds, typecheck/test scripts run even if there are no tests yet.

### Task 2: API Health Server

**Files:**

- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/config/env.ts`
- Test: `apps/api/tests/health.test.ts`

- [ ] Add env parsing with defaults for `DATABASE_PATH` and `API_PORT`.
- [ ] Create Fastify server with `GET /health`.
- [ ] Test that `/health` returns `{ "ok": true }`.
- [ ] Verify:

```bash
pnpm --filter @edgelord/api test
pnpm --filter @edgelord/api dev
curl http://localhost:4317/health
```

Expected: `{"ok":true}`.

### Task 3: Web Shell

**Files:**

- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/styles.css`
- Create: `apps/web/src/api/client.ts`

- [ ] Build a dark full-viewport app shell.
- [ ] Add a static top toolbar with labeled inactive controls for session, mode, import, replay controls, and export.
- [ ] Add two stacked empty chart panels labeled `SOXL 4H` and `SOXS 4H`.
- [ ] Add a static right-side capture panel shell with disabled Entry/Exit/Skip/Invalid controls.
- [ ] Verify:

```bash
pnpm --filter @edgelord/web dev
```

Expected: app opens locally with a dark cockpit layout.

## Phase 2: SQLite Data Model

### Task 4: Schema and Migrations

**Files:**

- Create: `apps/api/src/db/database.ts`
- Create: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/db/migrate.ts`
- Test: `apps/api/tests/schema.test.ts`

- [ ] Create SQLite database connection.
- [ ] Add migration runner.
- [ ] Create tables:
  - `sessions`
  - `base_bars`
  - `aggregated_bars`
  - `indicator_values`
  - `drawings`
  - `trade_events`
  - `audit_log`
  - `import_runs`
- [ ] Add unique indexes:
  - `base_bars(provider, ticker, timeframe, timestamp)`
  - `aggregated_bars(ticker, timeframe, timestamp)`
  - `indicator_values(ticker, timeframe, timestamp, name)`
- [ ] Store JSON columns as text with service-level parse/stringify.
- [ ] Test migration creates every table and index.
- [ ] Verify:

```bash
pnpm --filter @edgelord/api test apps/api/tests/schema.test.ts
```

Expected: schema test passes.

### Task 5: Audit Helper

**Files:**

- Create: `apps/api/src/audit/auditService.ts`
- Test: `apps/api/tests/audit.test.ts`

- [ ] Implement `recordAudit({ entityType, entityId, action, before, after })`.
- [ ] Support actions: `create`, `update`, `delete`.
- [ ] Do not require edit reasons.
- [ ] Test that create/update/delete audit rows persist with before/after JSON.

## Phase 3: Market Data Import and Aggregation

### Task 6: Market Data Provider Interface

**Files:**

- Create: `apps/api/src/market-data/types.ts`
- Create: `apps/api/src/market-data/alpacaProvider.ts`
- Test: `apps/api/tests/marketDataTypes.test.ts`

- [ ] Define `BaseBar` with `ticker`, `timestamp`, `open`, `high`, `low`, `close`, `volume`.
- [ ] Define `MarketDataProvider` with `getBars({ ticker, start, end, timeframe })`.
- [ ] Implement Alpaca provider for 1-minute bars first.
- [ ] Keep provider code isolated from aggregation and storage.
- [ ] Test provider request URL construction without hitting Alpaca.

### Task 7: RTH Calendar Utilities

**Files:**

- Create: `apps/api/src/aggregation/rthCalendar.ts`
- Test: `apps/api/tests/rthCalendar.test.ts`

- [ ] Implement `toNewYorkTime`.
- [ ] Implement `isRegularTradingMinute`.
- [ ] Implement `sessionDateForTimestamp`.
- [ ] Implement `sessionOpenForDate`.
- [ ] Implement `sessionCloseForDate`.
- [ ] Treat regular session as 9:30-16:00 ET.
- [ ] Test DST-safe behavior around representative winter and summer dates.

### Task 8: 4H Aggregation

**Files:**

- Create: `apps/api/src/aggregation/aggregateBars.ts`
- Test: `apps/api/tests/aggregateBars.test.ts`

- [ ] Implement `aggregateRthBars(baseBars, "4H")`.
- [ ] Reset buckets at 9:30 ET every trading day.
- [ ] First completed 4H candle covers 9:30-13:30 ET.
- [ ] Second completed 4H candle is not emitted because 13:30-16:00 is partial.
- [ ] Do not emit partial candles.
- [ ] Never span days.
- [ ] Test OHLC and volume:
  - open = first base open
  - high = max high
  - low = min low
  - close = last base close
  - volume = sum volume

### Task 9: Import Service

**Files:**

- Create: `apps/api/src/market-data/importService.ts`
- Create: `apps/api/src/routes/importRoutes.ts`
- Test: `apps/api/tests/importService.test.ts`

- [ ] Implement `POST /import` with `{ tickers, startDate, endDate, baseTimeframe }`.
- [ ] For v1, default to `SOXL`, `SOXS`, `2024-01-01` through current date, `1Min`.
- [ ] Fetch source bars through provider.
- [ ] Persist base bars.
- [ ] Aggregate and persist 4H bars.
- [ ] Align SOXL and SOXS timestamps after aggregation.
- [ ] Store import run status.
- [ ] Return counts and validation warnings.

## Phase 4: Indicator Engine

### Task 10: Shared Series Math

**Files:**

- Create: `apps/api/src/indicators/series.ts`
- Test: `apps/api/tests/series.test.ts`

- [ ] Implement SMA.
- [ ] Implement EMA.
- [ ] Implement RMA.
- [ ] Implement standard deviation.
- [ ] Implement highest/lowest lookback.
- [ ] Implement RSI.
- [ ] Implement Stoch RSI.
- [ ] Implement TSI.
- [ ] Use deterministic arrays indexed to candle order.
- [ ] Tests should cover warmup `null` values and known hand-calculated sequences.

### Task 11: Required Indicators

**Files:**

- Create: `apps/api/src/indicators/indicatorEngine.ts`
- Test: `apps/api/tests/indicatorEngine.test.ts`

- [ ] Compute:
  - volume 20 average
  - EMA 25 close
  - SMA 100 close
  - monthly VWAP
  - ATR 14 RMA
  - SMIO 20/20/10
  - Stoch RSI 7/10/14/15
  - CM_WVF_V3_Ult with locked settings
- [ ] Ensure every indicator reads only current and previous candles.
- [ ] Store indicator values by ticker/timeframe/timestamp/name.
- [ ] Test that changing future candles does not change indicator values at earlier timestamps.

### Task 12: Indicator API

**Files:**

- Create: `apps/api/src/routes/chartRoutes.ts`
- Test: `apps/api/tests/chartRoutes.test.ts`

- [ ] Implement `GET /chart/:ticker/:timeframe`.
- [ ] Return candles and indicator series for a ticker/timeframe.
- [ ] Implement `GET /chart/sync?timeframe=4H&tickers=SOXL,SOXS`.
- [ ] Return aligned SOXL/SOXS candle and indicator data.

## Phase 5: Replay UI

### Task 13: Zustand Store

**Files:**

- Create: `apps/web/src/store/useAppStore.ts`

- [ ] Store:
  - selected session
  - mode: `regular` or `replay`
  - replay index
  - replay speed
  - selected candle
  - chart data
  - drawings
  - capture panel state
- [ ] Add actions for play, pause, step forward, switch mode, select candle.

### Task 14: 4H Chart Grid

**Files:**

- Create: `apps/web/src/charts/ReplayChart.tsx`
- Create: `apps/web/src/charts/ChartGrid4H.tsx`
- Create: `apps/web/src/charts/indicatorPanes.ts`

- [ ] Render two synchronized 4H chart panels, SOXL above SOXS.
- [ ] Show candle series and volume.
- [ ] Overlay EMA 25, SMA 100, monthly VWAP.
- [ ] Render lower panes for SMIO, Stoch RSI, CM_WVF, ATR.
- [ ] In regular mode, show all loaded data.
- [ ] In replay mode, slice visible series through `replayIndex`.
- [ ] Keep chart crosshair/candle selection synchronized where practical.

### Task 15: Replay Toolbar

**Files:**

- Create: `apps/web/src/components/ReplayToolbar.tsx`

- [ ] Add mode toggle: Regular / Replay.
- [ ] Add start-date input for replay.
- [ ] Add play/pause.
- [ ] Add step-forward button.
- [ ] Add speed selector.
- [ ] Disable arbitrary forward jumps in replay mode.

## Phase 6: Labels, Sessions, and Capture

### Task 16: Session Service and UI

**Files:**

- Create: `apps/api/src/routes/sessionRoutes.ts`
- Create: `apps/web/src/components/SessionPanel.tsx`
- Test: `apps/api/tests/sessionRoutes.test.ts`

- [ ] Implement create session.
- [ ] Implement list sessions.
- [ ] Implement resume session.
- [ ] Implement end session.
- [ ] Include optional notes and ticker/timeframe focus.

### Task 17: Label Service

**Files:**

- Create: `apps/api/src/labels/labelService.ts`
- Create: `apps/api/src/routes/labelRoutes.ts`
- Test: `apps/api/tests/labelService.test.ts`

- [ ] Implement create label.
- [ ] Implement update label.
- [ ] Implement delete label.
- [ ] Validate:
  - label type is Entry/Exit/Skip/Invalid
  - confidence is 1-5
  - setup quality is 1-5
  - reason codes are known values
  - session exists
- [ ] On create/update/delete, write audit log.
- [ ] On save, compute context snapshots from selected ticker/timeframe/timestamp.
- [ ] Do not enforce entry/exit state.

### Task 18: Capture Panel

**Files:**

- Create: `apps/web/src/components/CapturePanel.tsx`

- [ ] Implement hotkeys:
  - `E` entry
  - `X` exit
  - `S` skip
  - `I` invalid
  - `Enter` save
  - `Esc` cancel
- [ ] Add visible buttons for Entry/Exit/Skip/Invalid.
- [ ] Add confidence segmented control 1-5.
- [ ] Add setup quality segmented control 1-5.
- [ ] Add reason-code toggles.
- [ ] Add optional notes field.
- [ ] Save against selected candle, or current replay candle if no candle is selected.
- [ ] Keep interaction fast enough for repeated labels.

## Phase 7: Drawings

### Task 19: Drawing Storage

**Files:**

- Create: `apps/api/src/drawings/drawingService.ts`
- Create: `apps/api/src/routes/drawingRoutes.ts`
- Test: `apps/api/tests/drawingService.test.ts`

- [ ] Implement create/update/delete drawing.
- [ ] Support `trendline`, `horizontal_level`, `breakout_marker`.
- [ ] Store anchors as JSON.
- [ ] Compute trendline slope from anchors.
- [ ] Write audit log for drawing changes.

### Task 20: Drawing UI

**Files:**

- Create: `apps/web/src/drawings/drawingTools.ts`
- Modify: `apps/web/src/charts/ReplayChart.tsx`

- [ ] Implement two-click trendline creation.
- [ ] Implement horizontal level creation.
- [ ] Implement delete selected drawing.
- [ ] Render drawings over chart.
- [ ] Persist drawings through API.
- [ ] Include drawings in label snapshot calculations.

## Phase 8: Export

### Task 21: Export Service

**Files:**

- Create: `apps/api/src/exports/exportService.ts`
- Create: `apps/api/src/routes/exportRoutes.ts`
- Create: `apps/web/src/components/ExportPanel.tsx`
- Test: `apps/api/tests/exportService.test.ts`

- [ ] Implement `GET /export/json`.
- [ ] Implement `GET /export/csv`.
- [ ] JSON includes current sessions, labels, drawings, snapshots.
- [ ] CSV flattens labels and important snapshot fields.
- [ ] Default export excludes audit log.
- [ ] Add optional `includeAudit=true` parameter for JSON only.

## Phase 9: Verification

### Task 22: Bias and Replay Safety Tests

**Files:**

- Test: `apps/api/tests/replaySafety.test.ts`

- [ ] Test aggregation emits only completed candles.
- [ ] Test indicators do not change for prior timestamps if future candles are modified.
- [ ] Test chart sync returns equal timestamp sets for SOXL/SOXS.
- [ ] Test replay API/UI can slice through current index without returning future candles in replay mode.

### Task 23: Browser Smoke Test

**Files:**

- Create: `apps/web/tests/smoke.spec.ts`

- [ ] Start API and web.
- [ ] Open app in browser.
- [ ] Verify 4H chart grid loads.
- [ ] Switch to replay mode.
- [ ] Step forward.
- [ ] Open capture panel with `E`.
- [ ] Save a label.
- [ ] Export JSON.

## Execution Order

1. Bootstrap project
2. API health and web shell
3. SQLite schema
4. Import and aggregation
5. Indicator engine
6. Chart APIs
7. Replay UI
8. Sessions and labels
9. Drawings
10. Export
11. Verification

## Validation Commands

Run before calling the MVP complete:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm dev
```

Then manually verify:

- Import SOXL/SOXS 2024-2026.
- Open SOXL/SOXS 4H charts.
- Toggle regular/replay mode.
- Step replay forward.
- Draw a trendline.
- Save Entry/Exit/Skip/Invalid labels.
- Edit a label and confirm audit row exists.
- Export JSON and CSV.

## Later Plans

After this MVP works, write separate plans for:

- `2H` and `1D` aggregation plus 2x3 grid expansion
- Review dashboard and pair inference
- Polygon/Massive provider
- Desktop packaging
