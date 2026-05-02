from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import Any

from rule_utils import classification_metrics, condition_label, conditions_match, parse_conditions, read_csv, rule_matches


def load_split_map(path: Path) -> dict[str, str]:
    return {row.get("label_id", ""): row.get("split", "") for row in read_csv(path)}


def metrics_for(rows: list[dict[str, str]], feature: str, direction: str, threshold: float) -> dict[str, float | int]:
    return classification_metrics(rows, lambda row: rule_matches(row, feature, direction, threshold))


def metrics_for_conditions(rows: list[dict[str, str]], conditions: list[dict[str, Any]]) -> dict[str, float | int]:
    return classification_metrics(rows, lambda row: conditions_match(row, conditions))


def evaluate_by_split(
    training_rows: list[dict[str, str]],
    split_map: dict[str, str],
    feature: str,
    direction: str,
    threshold: float,
) -> list[dict[str, float | int | str]]:
    output = []
    for split in ("train", "validate", "test"):
        rows = [row for row in training_rows if split_map.get(row.get("label_id", "")) == split]
        metrics = metrics_for(rows, feature, direction, threshold)
        output.append({"split": split, **metrics})
    return output


def evaluate_conditions_by_split(
    training_rows: list[dict[str, str]],
    split_map: dict[str, str],
    conditions: list[dict[str, Any]],
) -> list[dict[str, float | int | str]]:
    output = []
    for split in ("train", "validate", "test"):
        rows = [row for row in training_rows if split_map.get(row.get("label_id", "")) == split]
        metrics = metrics_for_conditions(rows, conditions)
        output.append({"split": split, **metrics})
    return output


def format_report(rows: list[dict[str, float | int | str]], feature: str, direction: str, threshold: float) -> str:
    lines = [
        "EdgeLord Split Rule Evaluation",
        "==============================",
        f"rule: {feature} {direction} {threshold:.4f}",
        "",
        "| Split | Rows | Human Entries | Model Entries | Precision | Recall | Agreement | TP | FP | FN | TN |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for row in rows:
        lines.append(
            f"| {row['split']} | {row['rows']} | {row['human_entries']} | {row['model_entries']} | "
            f"{float(row['precision']):.2f} | {float(row['recall']):.2f} | {float(row['agreement']):.2f} | "
            f"{row['true_positive']} | {row['false_positive']} | {row['false_negative']} | {row['true_negative']} |"
        )

    lines.extend(["", "Readiness"])
    if any(int(row["rows"]) == 0 for row in rows):
        lines.append("- One or more splits are empty. Keep labeling before trusting split performance.")
    elif sum(int(row["rows"]) for row in rows) < 100:
        lines.append("- Dataset is still small; use this as a scaffold, not a conclusion.")
    else:
        lines.append("- Split evaluation is populated. Compare validate/test behavior before promoting a rule.")
    return "\n".join(lines) + "\n"


def write_csv(path: Path, rows: list[dict[str, float | int | str]]) -> None:
    columns = [
        "split", "rows", "human_entries", "model_entries", "precision", "recall",
        "agreement", "true_positive", "false_positive", "false_negative", "true_negative"
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate one EdgeLord rule by chronological split.")
    parser.add_argument("--training", required=True, type=Path, help="Path to training-features.csv export")
    parser.add_argument("--splits", required=True, type=Path, help="Path to time-splits.csv")
    parser.add_argument("--feature", help="Feature column")
    parser.add_argument("--direction", choices=[">=", "<="], help="Threshold direction")
    parser.add_argument("--threshold", type=float, help="Numeric threshold")
    parser.add_argument("--conditions-json", help="JSON array of {feature,direction,threshold} conditions joined with AND")
    parser.add_argument("--output", type=Path, help="Optional markdown report path")
    parser.add_argument("--csv-output", type=Path, help="Optional CSV report path")
    args = parser.parse_args()

    if args.conditions_json:
        conditions = parse_conditions(args.conditions_json)
        rows = evaluate_conditions_by_split(read_csv(args.training), load_split_map(args.splits), conditions)
        report = format_report(rows, condition_label(conditions), "AND", 0).replace(" AND 0.0000", "")
        report = report.replace("EdgeLord Split Rule Evaluation", "EdgeLord Split Pair Rule Evaluation", 1)
    else:
        if args.feature is None or args.direction is None or args.threshold is None:
            raise ValueError("--feature, --direction, and --threshold are required unless --conditions-json is provided")
        rows = evaluate_by_split(read_csv(args.training), load_split_map(args.splits), args.feature, args.direction, args.threshold)
        report = format_report(rows, args.feature, args.direction, args.threshold)
    print(report, end="")
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report)
    if args.csv_output:
        write_csv(args.csv_output, rows)


if __name__ == "__main__":
    main()
