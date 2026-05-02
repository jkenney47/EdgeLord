# EdgeLord Research Scaffold

Goal:

1. Load `training-features.csv` and `trades.csv`.
2. Build a human-mimic model.
3. Build a return-optimized rule candidate.
4. Compare the model against Joseph's discretionary labels.
5. Generate a TradingView Pine Script strategy later.

This folder is intentionally only scaffolding. Do not build strategy mining UI into the app.

## First Report

Export the current app data, then run:

```bash
python3 research/dataset_report.py \
  --labels /path/to/labels.csv \
  --training /path/to/training-features.csv \
  --trades /path/to/trades.csv
```

The report checks label counts, training eligibility, entry/exit/skip balance, trade status, orphan links, and basic closed-trade return stats.
