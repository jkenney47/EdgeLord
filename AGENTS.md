# EdgeLord Agent Instructions

EdgeLord is now a minimal SOXL/SOXS trade labeler. Do not rebuild the old TradingView-style workstation.

Allowed scope:

- Load adjusted SOXL/SOXS OHLCV CSV data.
- Optionally download Alpaca adjusted bars into CSV before import.
- Aggregate `2H`, `4H`, and `1D` bars.
- Show one focused chart.
- Capture `ENTRY`, `EXIT`, `SKIP`, and `INVALID` labels.
- Enforce the long-only SOXL/SOXS state machine.
- Export labels, trades, training features, and JSONL.
- Keep a small research scaffold for later Pine Script strategy work.

Do not add drawing tools, trendlines, dashboards, dense review panels, broker integrations, alerts, watchlists, strategy mining UI, backtesting UI, or new indicators until the minimal labeler is working and useful.

Verification:

```bash
pnpm verify
```

Before closing out backend, labeling-rule, or export changes, run:

```bash
pnpm closeout:minimal-labeler
```

That command runs lint, tests, typecheck, web build, temporary acceptance, and live API smoke when the dev API is already running. The acceptance check uses a temporary SQLite database and verifies the SOXL/SOXS entry/exit/skip state machine plus CSV/JSONL exports without touching local labeling data.

After importing or replacing historical bars, run:

```bash
pnpm data:status
```

That command writes coverage, label-integrity, export-backup, and dataset-readiness reports. Use it to confirm the local database is on real adjusted data before serious labeling.

For Alpaca data, keep secrets in the shell environment only. Use `pnpm data:alpaca --start 2011-01-01 --end YYYY-MM-DD --output data/alpaca-soxl-soxs-1min.csv`, then validate/import that CSV through the normal `validate:csv` and `import:csv` commands.

Do not replace cached bars when active labels exist unless the user explicitly accepts the revalidation risk. The API and `pnpm import:csv --replace-bars` guard this by default; only use `--force-replace-bars` after an export backup and follow-up `pnpm labels:integrity`.

For browser/UI verification, use the Codex in-app browser at `http://127.0.0.1:5173/`.
