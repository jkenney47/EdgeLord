# EdgeLord Research

This folder is for turning EdgeLord exports into strategy-discovery evidence.

The app should first collect replay-safe `ENTRY`, `EXIT`, `SKIP`, and `INVALID` labels. These scripts inspect exported labels without adding app UI or changing the database.

## Inputs

Use the app export outputs when available:

- JSON export with `{ "manifest": ..., "events": [...] }`
- CSV export from the existing export service
- JSONL label export, one decision per line

Regular-mode and hindsight labels are excluded from training by default. The scripts prefer `trainingEligible` when present.

## Commands

Summarize a dataset:

```bash
python3 research/summarize_labels.py path/to/export.csv
python3 research/summarize_labels.py path/to/export.json
```

Print entry feature frequencies:

```bash
python3 research/discover_rules.py path/to/export.csv
```

Run a first walk-forward sanity check:

```bash
python3 research/walkforward_eval.py path/to/export.csv
```

Pair completed trades:

```bash
python3 research/pair_trades.py path/to/labels.csv > trades.csv
```

Compare human labels with a model signal file:

```bash
python3 research/human_vs_model_diff.py path/to/labels.csv path/to/model_signals.csv > human_vs_model_diff.csv
```

Build the first candidate packet:

```bash
python3 research/build_candidate_packet.py path/to/training-features.csv --out reports/latest
python3 research/human_vs_model_diff.py path/to/labels.csv reports/latest/model_signals.csv > reports/latest/human_vs_model_diff.csv
```

The packet writes:

- `candidate_rules.json`
- `candidate_rules.md`
- `model_signals.csv`
- `strategy_soxl_soxs.pine`

These scripts use only Python's standard library so they can run before the research stack is formalized.
