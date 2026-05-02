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

### Alpaca Backfill

Alpaca is an optional source for producing the adjusted CSV. EdgeLord still imports through the same local CSV path so downloaded data can be validated before it touches the labeling database.

Set credentials in your shell, not in the repo:

```bash
export ALPACA_API_KEY_ID=...
export ALPACA_API_SECRET_KEY=...
```

Download adjusted bars:

```bash
pnpm data:alpaca --start 2011-01-01 --end 2026-05-02 --output data/alpaca-soxl-soxs-1min.csv
pnpm validate:csv data/alpaca-soxl-soxs-1min.csv --research-ready
pnpm import:csv data/alpaca-soxl-soxs-1min.csv --replace-bars --research-ready
```

The downloader uses Alpaca's stock bars endpoint with `adjustment=all`, `feed=sip`, `limit=10000`, pagination, and regular-trading-hours filtering by default. If your Alpaca plan does not permit SIP history, the command will fail before writing database changes; rerun with the feed your account supports only if you accept the data-quality tradeoff. Use `--include-extended-hours` only for a separate experiment, not the main EdgeLord labeling dataset.

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

- `GET /state/dataset`
- `GET /export/labels.csv`
- `GET /export/trades.csv`
- `GET /export/training-features.csv`
- `GET /export/trade-candidates.csv`
- `GET /export/labels.jsonl`
- `GET /export/manifest.json`

Training features include only training-eligible labels by default and carry label source / capture mode metadata so research can segment actual trades from replay labels.
Trade candidates include HOLD/EXIT rows between training-eligible entry/exit pairs so exit-rule research can compare in-trade bars instead of only labeled decision rows.

## Verify

```bash
pnpm verify
```

For the common local workflow:

```bash
pnpm workflow:minimal-labeler
pnpm checkpoint:minimal-labeler
pnpm closeout:minimal-labeler
pnpm acceptance:minimal-labeler
pnpm workflow:minimal-labeler -- --acceptance
pnpm workflow:minimal-labeler -- --api-smoke
pnpm workflow:minimal-labeler -- --reset-db
pnpm export:backup
pnpm data:coverage
pnpm data:status
pnpm data:alpaca --start 2011-01-01 --end 2026-05-02 --output data/alpaca-soxl-soxs-1min.csv
pnpm validate:csv /path/to/adjusted-bars.csv
pnpm validate:csv /path/to/adjusted-bars.csv --research-ready
pnpm validate:csv /path/to/adjusted-bars.csv --research-ready --json-output reports/csv-validation.json
pnpm import:csv /path/to/adjusted-bars.csv
pnpm import:csv /path/to/adjusted-bars.csv --research-ready
pnpm import:csv /path/to/adjusted-bars.csv --replace-bars
pnpm import:csv /path/to/adjusted-bars.csv --replace-bars --force-replace-bars
pnpm labels:integrity
pnpm labels:repair
```

`closeout:minimal-labeler` is the default local closeout command. It runs lint, tests, typecheck, web build, temporary acceptance, and live API smoke when the dev API is already running.

`checkpoint:minimal-labeler` is the heavier end-of-slice command for backend/data/export/research work. It runs the closeout gate, then `data:status`, then prints final git status. Use it when the local API is already running and you want one command to verify code plus current dataset readiness.

`export:backup` writes `labels.csv`, `trades.csv`, `training-features.csv`, `trade-candidates.csv`, `labels.jsonl`, the API export manifest, and a backup manifest into `exports/YYYYMMDDTHHMMSSZ/`. Export payloads are ignored by git; only `exports/.gitkeep` is tracked.

`data:coverage` writes SOXL/SOXS `1D`/`4H`/`2H` coverage reports into `reports/` so you can tell whether you are still on sample data or have enough history for research. It writes both markdown and JSON; the JSON includes a readiness code such as `sample_only`, `too_short`, or `ready`.

`data:status` runs coverage, label integrity, export backup, and the dataset readiness report as one post-import health check. Run it after importing real adjusted data and periodically while labeling. It writes `reports/<timestamp>-data-status.json` with command results and pointers to the latest coverage, integrity, and research summary artifacts.

`validate:csv` checks a local adjusted OHLCV CSV for required columns, SOXL/SOXS rows, duplicate ticker/timestamps, valid dates, positive OHLCV, and internally consistent OHLC values. Duplicate ticker/timestamps are import errors because the API rejects them too. Add `--research-ready` to fail when either ticker starts after the target start date or has too little history. Defaults: `--target-start 2011-01-01 --min-years 10`. Alpaca SIP minute history currently starts at `2016-01-04` for this dataset, so use `--target-start 2016-01-04` for the Alpaca-minute backfill and keep 2011 as an unresolved external data-source gap. Add `--json-output reports/csv-validation.json` when you want a machine-readable importability and research-readiness verdict.

`import:csv` imports a local adjusted OHLCV CSV into the running API by file path, then writes a fresh coverage report. Use `--research-ready` when importing the real backfill so short/incomplete files fail before they touch the database. Use `--replace-bars` when importing a full historical dataset so old sample/cache bars do not remain mixed into the chart cache. Replacement is blocked while active labels exist unless you also pass `--force-replace-bars`; export a backup first, then run `labels:integrity` afterward because labels/trades are not deleted.

`labels:integrity` checks existing labels against the current bar cache and writes a report for missing candles, stale bar indexes, and chart-price mismatches. Run it after replacing bars. `labels:repair` updates labels that still point to an existing candle but have stale bar indexes or chart prices after a data replacement; it does not repair labels whose candles are missing.

`--acceptance` starts a temporary API with a temporary SQLite database, seeds the sample bars, creates entry/exit/skip/hindsight labels, verifies the no-reversal state machine, and checks the export endpoints. It does not touch your real local labeling database.

`--reset-db` removes the local SQLite files in `data/`. Use it only when you intentionally want a clean local labeling database.
