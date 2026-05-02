# EdgeLord Research Scaffold

Goal:

1. Load `training-features.csv` and `trades.csv`.
2. Build a human-mimic model.
3. Build a return-optimized rule candidate.
4. Compare the model against Joseph's discretionary labels.
5. Generate a TradingView Pine Script strategy later.

This folder is intentionally only scaffolding. Do not build strategy mining UI into the app.

`training-features.csv` is the primary model table. It includes one row per training-eligible label, explicit target columns for ENTRY/EXIT/SKIP/INVALID, chart price, optional execution price, and `decision_price` using execution price when available. `SKIP` rows are flat-state negative examples; in-trade non-exit bars come from `trade-candidates.csv` as HOLD candidates after an entry/exit pair is closed.
`schema.json` is the contract for exported datasets. It lists each CSV/JSONL file, feature column, target column, training policy, and whether a feature is currently mapped into the generated Pine scaffold.
`pine_feature_map.json` is the shared source for Pine expressions used by both the API export schema and `generate_pine_stub.py`.

## First Report

With the API running, use the repo command:

```bash
pnpm research:report
```

That command saves a timestamped export backup under `exports/` and writes the report under `reports/`. The export backup's `manifest.json` embeds the parsed API export manifest, so the folder remains self-describing even when reviewed away from the live API. Both output directories are ignored by git except for `.gitkeep`.

It writes:

- `reports/<timestamp>-dataset-report.md`
- `reports/<timestamp>-dataset-report.json`
- `reports/<timestamp>-candidate-rules.md`
- `reports/<timestamp>-candidate-rules.json`
- `reports/<timestamp>-human-vs-rule.md`
- `reports/<timestamp>-human-vs-rule.csv`
- `reports/<timestamp>-human-vs-pair-rule.md`
- `reports/<timestamp>-human-vs-pair-rule.csv`
- `reports/<timestamp>-time-splits.md`
- `reports/<timestamp>-time-splits.csv`
- `reports/<timestamp>-split-rule-eval.md`
- `reports/<timestamp>-split-rule-eval.csv`
- `reports/<timestamp>-split-pair-rule-eval.md`
- `reports/<timestamp>-split-pair-rule-eval.csv`
- `reports/<timestamp>-entry-outcomes.md`
- `reports/<timestamp>-entry-outcomes.csv`
- `reports/<timestamp>-return-rules.md`
- `reports/<timestamp>-return-rules.json`
- `reports/<timestamp>-exit-rules.md`
- `reports/<timestamp>-exit-rules.json`
- `reports/<timestamp>-strategy-rules.v1.json`
- `reports/<timestamp>-strategy-soxl-soxs.pine`
- `reports/<timestamp>-research-summary.json`

`research-summary.json` is the machine-readable index for downstream work. It points to every generated artifact, embeds the API export manifest, embeds the dataset readiness counts/issues, and includes the top human-mimic and return-optimized rules when available. The embedded export manifest includes trade-candidate coverage, which is the quick check for whether exit-rule mining has real HOLD/EXIT rows. `strategy-rules.v1.json` is the TradingView handoff contract: it carries the selected candidate rules, source-file fingerprints, Pine feature-map version, Pine feature support status, rough dataset targets, and the promotion checklist that must pass before a generated signal should be treated as more than a scaffold.

Or export CSV files manually and run:

```bash
python3 research/dataset_report.py \
  --labels /path/to/labels.csv \
  --training /path/to/training-features.csv \
  --trades /path/to/trades.csv \
  --json-output /path/to/dataset-report.json
```

The report checks label counts, training eligibility, entry/exit/skip balance, trade status, orphan links, state-machine sequence issues, feature coverage, basic closed-trade return stats, ENTRY-vs-SKIP feature contrasts, and what to label next.

To generate only the simple rule-candidate report from a training export:

```bash
python3 research/discover_rules.py \
  --training /path/to/training-features.csv \
  --json-output /path/to/candidate-rules.json
```

Candidate rules include one-feature threshold prompts plus pairwise `AND` candidates across the best one-feature rules. They are research prompts, not a tested strategy.

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

The comparison buckets labels into human/model agreement, model-rejected human entries, and model-added entries on human skips. The markdown report also includes a review queue, feature context for disagreements, and simple feature-delta clusters so rule differences are inspectable without opening the CSV first. The CSV includes `review_priority` and `review_reason` columns for turning disagreements into a labeling/review checklist.

For pairwise `AND` candidates, pass conditions as JSON:

```bash
python3 research/compare_rule.py \
  --training /path/to/training-features.csv \
  --conditions-json '[{"feature":"feature_distance_to_ema25_pct","direction":">=","threshold":1.5},{"feature":"feature_close_above_ema25","direction":">=","threshold":1}]' \
  --output /path/to/human-vs-pair-rule.md \
  --csv-output /path/to/human-vs-pair-rule.csv
```

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

Pairwise split evaluation uses the same `--conditions-json` option and is generated automatically by `pnpm research:report` when a pair candidate exists.

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

To generate rough exit-rule candidates:

```bash
python3 research/discover_exit_rules.py \
  --training /path/to/training-features.csv \
  --candidates /path/to/trade-candidates.csv \
  --output /path/to/exit-rules.md \
  --json-output /path/to/exit-rules.json
```

When `trade-candidates.csv` is present, this uses in-trade HOLD-vs-EXIT rows from closed training-eligible trades. Without that file, it falls back to the weaker EXIT-vs-non-EXIT scaffold over labeled decision rows.

To generate only the TradingView-facing scaffold from candidate rules:

```bash
python3 research/generate_pine_stub.py \
  --rules-json /path/to/candidate-rules.json \
  --return-rules-json /path/to/return-rules.json \
  --exit-rules-json /path/to/exit-rules.json \
  --dataset-report-json /path/to/dataset-report.json \
  --rules-output /path/to/strategy-rules.v1.json \
  --pine-output /path/to/strategy-soxl-soxs.pine
```

The Pine file is a research scaffold. It carries the human-mimic top rule, the human-mimic top pair rule, the rough exit rule, and the return-optimized top rule. When the pair rule's features are mapped to Pine, the scaffold uses that pair entry signal; otherwise it falls back to the one-feature human-mimic signal. It can also wire the rough exit candidate into `strategy.close`, but that exit logic is not promotion-ready until the dataset has true in-trade HOLD-vs-EXIT candidates. `strategy-rules.v1.json` records dataset readiness, rough label-count targets, promotion warnings, and whether each top rule is currently mapped to a Pine expression. Unsupported features remain explicit TODOs instead of being silently approximated.
