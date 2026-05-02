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

It writes:

- `reports/<timestamp>-dataset-report.md`
- `reports/<timestamp>-candidate-rules.md`
- `reports/<timestamp>-candidate-rules.json`
- `reports/<timestamp>-human-vs-rule.md`
- `reports/<timestamp>-human-vs-rule.csv`

Or export CSV files manually and run:

```bash
python3 research/dataset_report.py \
  --labels /path/to/labels.csv \
  --training /path/to/training-features.csv \
  --trades /path/to/trades.csv
```

The report checks label counts, training eligibility, entry/exit/skip balance, trade status, orphan links, feature coverage, basic closed-trade return stats, ENTRY-vs-SKIP feature contrasts, and what to label next.

To generate only the simple rule-candidate report from a training export:

```bash
python3 research/discover_rules.py \
  --training /path/to/training-features.csv \
  --json-output /path/to/candidate-rules.json
```

Candidate rules are one-feature threshold prompts for research, not a tested strategy.

To compare one simple rule against human ENTRY/SKIP labels:

```bash
python3 research/compare_rule.py \
  --training /path/to/training-features.csv \
  --feature feature_distance_to_ema25_pct \
  --direction ">=" \
  --threshold 1.5 \
  --output /path/to/human-vs-rule.md \
  --csv-output /path/to/human-vs-rule.csv
```

The comparison buckets labels into human/model agreement, model-rejected human entries, and model-added entries on human skips.
