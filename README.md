# EdgeLord Minimal Labeler

EdgeLord is a local-first SOXL/SOXS trade labeling app. It is intentionally boring: one chart, one capture panel, clean exports.

## Goal

Collect replay-safe discretionary labels for SOXL/SOXS, link entries and exits into trades, export training datasets, and later use those datasets to produce a TradingView Pine Script strategy.

## Stack

- TypeScript
- React + Vite
- Fastify
- SQLite via `better-sqlite3`
- `lightweight-charts`
- Python research scripts

## Run

```bash
pnpm install
pnpm dev
```

API: `http://127.0.0.1:4317`  
Web: `http://127.0.0.1:5173`

If no imported data exists, the API seeds a tiny adjusted SOXL/SOXS sample fixture from `data/sample-bars.csv`.

## CSV Import

Use `Import CSV` in the app top bar, or call the API directly. The app import replaces the cached sample/chart bars so a real historical CSV does not silently mix with fixture data. Replacement is blocked if active labels already exist.

`POST /import/csv` accepts either raw CSV text or JSON:

```json
{ "path": "data/my-adjusted-bars.csv" }
```

CSV format:

```csv
ticker,timestamp,open,high,low,close,volume
SOXL,2011-01-03T14:30:00.000Z,1.23,1.25,1.20,1.24,123456
```

Only adjusted OHLCV should be imported.

## State Machine

```text
FLAT
  -> ENTRY SOXL
  -> ENTRY SOXS
  -> SKIP

LONG_SOXL
  -> EXIT SOXL

LONG_SOXS
  -> EXIT SOXS
```

Opposite ETF entry is blocked while a trade is open. Switching requires an explicit exit, then a separate entry.

## Exports

- `GET /export/labels.csv`
- `GET /export/trades.csv`
- `GET /export/training-features.csv`
- `GET /export/labels.jsonl`

Training features include only training-eligible labels by default and carry label source / capture mode metadata so research can segment actual trades from replay labels.

## Verify

```bash
pnpm verify
```

For the common local workflow:

```bash
pnpm workflow:minimal-labeler
pnpm closeout:minimal-labeler
pnpm acceptance:minimal-labeler
pnpm workflow:minimal-labeler -- --acceptance
pnpm workflow:minimal-labeler -- --api-smoke
pnpm workflow:minimal-labeler -- --reset-db
pnpm export:backup
pnpm data:coverage
pnpm data:status
pnpm validate:csv /path/to/adjusted-bars.csv
pnpm validate:csv /path/to/adjusted-bars.csv --research-ready
pnpm validate:csv /path/to/adjusted-bars.csv --research-ready --json-output reports/csv-validation.json
pnpm import:csv /path/to/adjusted-bars.csv
pnpm import:csv /path/to/adjusted-bars.csv --research-ready
pnpm import:csv /path/to/adjusted-bars.csv --replace-bars
pnpm import:csv /path/to/adjusted-bars.csv --replace-bars --force-replace-bars
pnpm labels:integrity
```

`closeout:minimal-labeler` is the default local closeout command. It runs lint, tests, typecheck, web build, temporary acceptance, and live API smoke when the dev API is already running.

`export:backup` writes `labels.csv`, `trades.csv`, `training-features.csv`, `labels.jsonl`, and a manifest into `exports/YYYYMMDDTHHMMSSZ/`. Export payloads are ignored by git; only `exports/.gitkeep` is tracked.

`data:coverage` writes SOXL/SOXS `1D`/`4H`/`2H` coverage reports into `reports/` so you can tell whether you are still on sample data or have enough history for research. It writes both markdown and JSON; the JSON includes a readiness code such as `sample_only`, `too_short`, or `ready`.

`data:status` runs coverage, label integrity, export backup, and the dataset readiness report as one post-import health check. Run it after importing real adjusted data and periodically while labeling. It writes `reports/<timestamp>-data-status.json` with command results and pointers to the latest coverage, integrity, and research summary artifacts.

`validate:csv` checks a local adjusted OHLCV CSV for required columns, SOXL/SOXS rows, duplicate ticker/timestamps, valid dates, positive OHLCV, and internally consistent OHLC values. Add `--research-ready` to fail when duplicate rows exist or either ticker starts after the target start date / has too little history. Defaults: `--target-start 2011-01-01 --min-years 10`. Add `--json-output reports/csv-validation.json` when you want a machine-readable importability and research-readiness verdict.

`import:csv` imports a local adjusted OHLCV CSV into the running API, then writes a fresh coverage report. Use `--research-ready` when importing the real backfill so short/incomplete files fail before they touch the database. Use `--replace-bars` when importing a full historical dataset so old sample/cache bars do not remain mixed into the chart cache. Replacement is blocked while active labels exist unless you also pass `--force-replace-bars`; export a backup first, then run `labels:integrity` afterward because labels/trades are not deleted.

`labels:integrity` checks existing labels against the current bar cache and writes a report for missing candles, stale bar indexes, and chart-price mismatches. Run it after replacing bars.

`--acceptance` starts a temporary API with a temporary SQLite database, seeds the sample bars, creates entry/exit/skip/hindsight labels, verifies the no-reversal state machine, and checks the export endpoints. It does not touch your real local labeling database.

`--reset-db` removes the local SQLite files in `data/`. Use it only when you intentionally want a clean local labeling database.
