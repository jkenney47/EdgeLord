from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


Rule = dict[str, Any]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="") as handle:
        return list(csv.DictReader(handle))


def numeric_value(row: dict[str, str], column: str) -> float | None:
    raw = row.get(column, "")
    if raw == "":
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def candidate_thresholds(values: list[float]) -> list[float]:
    unique = sorted(set(values))
    if len(unique) <= 12:
        return unique

    indexes = {
        round((len(unique) - 1) * fraction)
        for fraction in (0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9)
    }
    return [unique[index] for index in sorted(indexes)]


def score_rule(rows: list[dict[str, str]], column: str, threshold: float, direction: str) -> Rule:
    usable = [(row, numeric_value(row, column)) for row in rows]
    usable = [(row, value) for row, value in usable if value is not None]
    if not usable:
        return {}

    total_exits = sum(1 for row, _value in usable if row.get("action") == "EXIT")
    if direction == ">=":
        matches = [(row, value) for row, value in usable if value >= threshold]
    else:
        matches = [(row, value) for row, value in usable if value <= threshold]
    if not matches:
        return {}

    exit_matches = sum(1 for row, _value in matches if row.get("action") == "EXIT")
    base_rate = total_exits / len(usable) if usable else 0
    precision = exit_matches / len(matches)
    recall = exit_matches / total_exits if total_exits else 0
    lift = precision / base_rate if base_rate else 0
    return {
        "feature": column,
        "direction": direction,
        "threshold": threshold,
        "matched": len(matches),
        "exits": exit_matches,
        "precision": precision,
        "recall": recall,
        "lift": lift,
    }


def discover(input_rows: list[dict[str, str]], non_exit_actions: set[str]) -> list[Rule]:
    rows = [row for row in input_rows if row.get("action") in non_exit_actions | {"EXIT"}]
    if not rows:
        return []

    feature_columns = [column for column in rows[0].keys() if column.startswith("feature_")]
    candidates: list[Rule] = []
    for column in feature_columns:
        values = [value for row in rows if (value := numeric_value(row, column)) is not None]
        if len(values) < 2:
            continue
        for threshold in candidate_thresholds(values):
            for direction in (">=", "<="):
                score = score_rule(rows, column, threshold, direction)
                if score and score["exits"]:
                    candidates.append(score)

    return sorted(
        candidates,
        key=lambda item: (float(item["lift"]), float(item["precision"]), float(item["recall"]), int(item["matched"])),
        reverse=True,
    )


def format_report(input_rows: list[dict[str, str]], candidates: list[Rule], source: str, non_exit_actions: set[str]) -> str:
    rows = [row for row in input_rows if row.get("action") in non_exit_actions | {"EXIT"}]
    exit_count = sum(1 for row in rows if row.get("action") == "EXIT")
    non_exit_count = sum(1 for row in rows if row.get("action") in non_exit_actions)
    if source == "trade_candidates":
        notes = [
            "- These are rough EXIT-vs-HOLD thresholds over in-trade candidate bars.",
            "- Candidate bars are generated from closed training-eligible trades only.",
            "- Use them as a scaffold until the dataset has many closed trades across market regimes.",
        ]
    else:
        notes = [
            "- These are rough EXIT-vs-non-EXIT thresholds over labeled decision rows.",
            "- They are not a true in-trade HOLD-vs-EXIT model because no trade-candidate export was provided.",
            "- Use them as a Pine scaffold prompt only until more explicit EXIT labels and candidate bars exist.",
        ]
    lines = [
        "EdgeLord Exit Rule Candidates",
        "============================",
        f"source: {source}",
        f"exit_rows: {exit_count}",
        f"non_exit_rows: {non_exit_count}",
        "",
        "Notes",
        *notes,
        "",
        "Top Candidates",
    ]

    if not candidates:
        lines.append("- Need numeric feature coverage plus EXIT and non-EXIT training rows.")
        return "\n".join(lines) + "\n"

    lines.append("| Feature | Rule | Matched | Exits | Precision | Recall | Lift |")
    lines.append("| --- | --- | ---: | ---: | ---: | ---: | ---: |")
    for candidate in candidates[:25]:
        threshold = float(candidate["threshold"])
        lines.append(
            f"| {candidate['feature']} | {candidate['direction']} {threshold:.4f} | "
            f"{candidate['matched']} | {candidate['exits']} | "
            f"{float(candidate['precision']):.2f} | {float(candidate['recall']):.2f} | {float(candidate['lift']):.2f} |"
        )
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate rough EdgeLord EXIT-vs-non-EXIT rule candidates.")
    parser.add_argument("--training", required=True, type=Path, help="Path to training-features.csv export")
    parser.add_argument("--candidates", type=Path, help="Optional trade-candidates.csv export for true HOLD-vs-EXIT rows")
    parser.add_argument("--output", type=Path, help="Optional path to write exit-rule markdown")
    parser.add_argument("--json-output", type=Path, help="Optional path to write exit-rule JSON")
    args = parser.parse_args()

    if args.candidates and args.candidates.exists():
        rows = read_csv(args.candidates)
        source = "trade_candidates"
        non_exit_actions = {"HOLD"}
    else:
        rows = read_csv(args.training)
        source = "training_features"
        non_exit_actions = {"ENTRY", "SKIP"}
    candidates = discover(rows, non_exit_actions)
    report = format_report(rows, candidates, source, non_exit_actions)
    print(report, end="")
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report)
    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(f"{json.dumps({'source': source, 'candidates': candidates}, indent=2)}\n")


if __name__ == "__main__":
    main()
