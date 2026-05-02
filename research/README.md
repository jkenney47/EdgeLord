# EdgeLord Research Scaffold

Goal:

1. Load `training-features.csv` and `trades.csv`.
2. Build a human-mimic model.
3. Build a return-optimized rule candidate.
4. Compare the model against Joseph's discretionary labels.
5. Generate a TradingView Pine Script strategy later.

This folder is intentionally only scaffolding. Do not build strategy mining UI into the app.

## First Report

With the API running, use the repo command:

```bash
pnpm research:report
```

That command saves a timestamped export backup under `exports/` and writes the report under `reports/`. Both output directories are ignored by git except for `.gitkeep`.

Or export CSV files manually and run:

```bash
python3 research/dataset_report.py \
  --labels /path/to/labels.csv \
  --training /path/to/training-features.csv \
  --trades /path/to/trades.csv
```

The report checks label counts, training eligibility, entry/exit/skip balance, trade status, orphan links, feature coverage, basic closed-trade return stats, ENTRY-vs-SKIP feature contrasts, and what to label next.
