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
- `reports/<timestamp>-time-splits.md`
- `reports/<timestamp>-time-splits.csv`
- `reports/<timestamp>-split-rule-eval.md`
- `reports/<timestamp>-split-rule-eval.csv`
- `reports/<timestamp>-entry-outcomes.md`
- `reports/<timestamp>-entry-outcomes.csv`
- `reports/<timestamp>-return-rules.md`
- `reports/<timestamp>-return-rules.json`
- `reports/<timestamp>-strategy-rules.v1.json`
- `reports/<timestamp>-strategy-soxl-soxs.pine`
- `reports/<timestamp>-research-summary.json`

`research-summary.json` is the machine-readable index for downstream work. It points to every generated artifact and includes the top human-mimic and return-optimized rules when available.

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

To create only chronological train/validate/test split assignments:

```bash
python3 research/time_splits.py \
  --training /path/to/training-features.csv \
  --output /path/to/time-splits.md \
  --csv-output /path/to/time-splits.csv
```

The split scaffold uses chronological 60/20/20 row assignment. It is a research guardrail, not a claim that the dataset is large enough yet.

To evaluate one simple rule by split:

```bash
python3 research/split_rule_eval.py \
  --training /path/to/training-features.csv \
  --splits /path/to/time-splits.csv \
  --feature feature_distance_to_ema25_pct \
  --direction ">=" \
  --threshold 1.5 \
  --output /path/to/split-rule-eval.md \
  --csv-output /path/to/split-rule-eval.csv
```

Use validate/test split behavior as an early warning before promoting a candidate rule.

To compare entry-time features on winning vs losing closed trades:

```bash
python3 research/entry_outcome_analysis.py \
  --training /path/to/training-features.csv \
  --trades /path/to/trades.csv \
  --output /path/to/entry-outcomes.md \
  --csv-output /path/to/entry-outcomes.csv
```

This is the first return-optimizer scaffold. It needs closed trades with training-eligible ENTRY labels before it can say anything useful.

To rank simple entry filters by closed-trade return:

```bash
python3 research/optimize_entry_rules.py \
  --training /path/to/training-features.csv \
  --trades /path/to/trades.csv \
  --output /path/to/return-rules.md \
  --json-output /path/to/return-rules.json
```

This is separate from the human-mimic rule report. It asks which labeled-entry conditions had better returns, not which conditions best predict Joseph's ENTRY labels.

To generate only the TradingView-facing scaffold from candidate rules:

```bash
python3 research/generate_pine_stub.py \
  --rules-json /path/to/candidate-rules.json \
  --return-rules-json /path/to/return-rules.json \
  --rules-output /path/to/strategy-rules.v1.json \
  --pine-output /path/to/strategy-soxl-soxs.pine
```

The Pine file is a research scaffold. It carries both the human-mimic top rule and the return-optimized top rule, but implements only the human-mimic candidate signal until exit logic and return-optimized backtesting are stronger. It maps only a small set of simple exported features to Pine expressions and leaves unsupported features as TODO comments.
