from __future__ import annotations

import argparse
import csv
from collections import Counter
from pathlib import Path
from typing import Any

from rule_utils import (
    condition_label,
    condition_values,
    conditions_match,
    numeric_value,
    parse_conditions,
    read_csv,
    rule_matches,
)


def category_for(action: str, model_enters: bool) -> str:
    if action == "ENTRY" and model_enters:
        return "human_and_model_enter"
    if action == "ENTRY" and not model_enters:
        return "human_entered_model_skipped"
    if action == "SKIP" and model_enters:
        return "model_entered_human_skipped"
    return "both_skipped"


def compare(rows: list[dict[str, str]], feature: str, direction: str, threshold: float) -> list[dict[str, str]]:
    compared: list[dict[str, str]] = []
    for row in rows:
        action = row.get("action", "")
        if action not in {"ENTRY", "SKIP"}:
            continue
        model_enters = rule_matches(row, feature, direction, threshold)
        compared.append({
            "label_id": row.get("label_id", ""),
            "timestamp": row.get("timestamp", ""),
            "ticker": row.get("ticker", ""),
            "timeframe": row.get("timeframe", ""),
            "human_action": action,
            "model_action": "ENTRY" if model_enters else "SKIP",
            "category": category_for(action, model_enters),
            "feature": feature,
            "direction": direction,
            "threshold": f"{threshold:.8g}",
            "feature_value": row.get(feature, ""),
        })
    return compared


def compare_conditions(rows: list[dict[str, str]], conditions: list[dict[str, Any]]) -> list[dict[str, str]]:
    compared: list[dict[str, str]] = []
    rule_label = condition_label(conditions)
    for row in rows:
        action = row.get("action", "")
        if action not in {"ENTRY", "SKIP"}:
            continue
        model_enters = conditions_match(row, conditions)
        compared.append({
            "label_id": row.get("label_id", ""),
            "timestamp": row.get("timestamp", ""),
            "ticker": row.get("ticker", ""),
            "timeframe": row.get("timeframe", ""),
            "human_action": action,
            "model_action": "ENTRY" if model_enters else "SKIP",
            "category": category_for(action, model_enters),
            "feature": rule_label,
            "direction": "AND",
            "threshold": "",
            "feature_value": condition_values(row, conditions),
        })
    return compared


def feature_columns(rows: list[dict[str, str]]) -> list[str]:
    if not rows:
        return []
    return [column for column in rows[0].keys() if column.startswith("feature_")]


def average(rows: list[dict[str, str]], column: str) -> float | None:
    values = [value for row in rows if (value := numeric_value(row, column)) is not None]
    if not values:
        return None
    return sum(values) / len(values)


def format_context_value(row: dict[str, str], column: str) -> str:
    raw = row.get(column, "")
    if raw == "":
        return "-"
    return raw


def format_disagreement_context(training: list[dict[str, str]], compared: list[dict[str, str]]) -> list[str]:
    by_label = {row.get("label_id", ""): row for row in training}
    columns = [
        "feature_distance_to_ema25_pct",
        "feature_stoch_rsi_k",
        "feature_stoch_rsi_d",
        "feature_close_above_ema25",
        "feature_pair_ratio_close",
        "feature_d1_close_above_ema25",
        "feature_h4_close_above_ema25",
        "feature_h2_close_above_ema25",
    ]
    available_columns = [column for column in columns if any(column in row for row in training)]
    lines = ["", "Disagreement Context"]
    disagreements = [row for row in compared if row["category"] in {"human_entered_model_skipped", "model_entered_human_skipped"}]
    if not disagreements:
        return [*lines, "- none"]
    if not available_columns:
        return [*lines, "- no feature context columns available"]

    for row in disagreements[:12]:
        source = by_label.get(row["label_id"], {})
        context = ", ".join(f"{column.replace('feature_', '')}={format_context_value(source, column)}" for column in available_columns)
        lines.append(
            f"- {row['category']}: {row['ticker']} {row['timeframe']} {row['timestamp']} "
            f"human={row['human_action']} model={row['model_action']} | {context}"
        )
    return lines


def format_category_contrasts(training: list[dict[str, str]], compared: list[dict[str, str]]) -> list[str]:
    by_label = {row.get("label_id", ""): row for row in training}
    columns = feature_columns(training)
    lines = ["", "Why Disagreements Cluster"]
    if not columns:
        return [*lines, "- no feature columns available"]

    any_category = False
    for category in ["human_entered_model_skipped", "model_entered_human_skipped"]:
        labels = {row["label_id"] for row in compared if row["category"] == category}
        category_rows = [row for label_id in labels if (row := by_label.get(label_id))]
        other_rows = [row for row in training if row.get("label_id", "") not in labels and row.get("action") in {"ENTRY", "SKIP"}]
        if not category_rows or not other_rows:
            continue
        deltas: list[tuple[str, float, float, float]] = []
        for column in columns:
            category_avg = average(category_rows, column)
            other_avg = average(other_rows, column)
            if category_avg is None or other_avg is None:
                continue
            deltas.append((column, category_avg - other_avg, category_avg, other_avg))
        if not deltas:
            continue
        any_category = True
        lines.append(f"{category}:")
        for column, delta, category_avg, other_avg in sorted(deltas, key=lambda item: abs(item[1]), reverse=True)[:8]:
            lines.append(
                f"- {column}: category_avg={category_avg:.4f}, other_avg={other_avg:.4f}, delta={delta:.4f}"
            )

    if not any_category:
        lines.append("- not enough disagreement rows with numeric feature overlap")
    return lines


def format_report(training: list[dict[str, str]], compared: list[dict[str, str]], feature: str, direction: str, threshold: float) -> str:
    counts = Counter(row["category"] for row in compared)
    total = len(compared)
    model_entries = sum(1 for row in compared if row["model_action"] == "ENTRY")
    human_entries = sum(1 for row in compared if row["human_action"] == "ENTRY")
    agreement = counts["human_and_model_enter"] + counts["both_skipped"]
    lines = [
        "EdgeLord Human vs Rule Comparison",
        "=================================",
        f"rule: {feature} {direction} {threshold:.4f}",
        f"rows: {total}",
        f"human_entries: {human_entries}",
        f"model_entries: {model_entries}",
        f"agreement_rate: {(agreement / total) * 100:.1f}%" if total else "agreement_rate: 0.0%",
        "",
        "| Category | Count | Meaning |",
        "| --- | ---: | --- |",
        f"| human_and_model_enter | {counts['human_and_model_enter']} | Human and rule both enter |",
        f"| human_entered_model_skipped | {counts['human_entered_model_skipped']} | Rule rejects a human entry |",
        f"| model_entered_human_skipped | {counts['model_entered_human_skipped']} | Rule finds an entry on a human skip |",
        f"| both_skipped | {counts['both_skipped']} | Human and rule both skip |",
        "",
        "Largest Disagreements",
    ]

    disagreements = [row for row in compared if row["category"] in {"human_entered_model_skipped", "model_entered_human_skipped"}]
    if not disagreements:
        lines.append("- none")
    else:
        for row in disagreements[:25]:
            lines.append(
                f"- {row['category']}: {row['ticker']} {row['timeframe']} {row['timestamp']} "
                f"value={row['feature_value']} human={row['human_action']} model={row['model_action']}"
            )
    lines.extend(format_disagreement_context(training, compared))
    lines.extend(format_category_contrasts(training, compared))
    return "\n".join(lines) + "\n"


def format_conditions_report(training: list[dict[str, str]], compared: list[dict[str, str]], conditions: list[dict[str, Any]]) -> str:
    report = format_report(training, compared, condition_label(conditions), "AND", 0).replace(" AND 0.0000", "")
    return report.replace("EdgeLord Human vs Rule Comparison", "EdgeLord Human vs Pair Rule Comparison", 1)


def write_comparison_csv(path: Path, compared: list[dict[str, str]]) -> None:
    columns = [
        "label_id", "timestamp", "ticker", "timeframe", "human_action", "model_action",
        "category", "feature", "direction", "threshold", "feature_value"
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(compared)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare one simple rule against EdgeLord ENTRY/SKIP labels.")
    parser.add_argument("--training", required=True, type=Path, help="Path to training-features.csv export")
    parser.add_argument("--feature", help="Feature column, for example feature_distance_to_ema25_pct")
    parser.add_argument("--direction", choices=[">=", "<="], help="Threshold direction")
    parser.add_argument("--threshold", type=float, help="Numeric threshold")
    parser.add_argument("--conditions-json", help="JSON array of {feature,direction,threshold} conditions joined with AND")
    parser.add_argument("--output", type=Path, help="Optional markdown report path")
    parser.add_argument("--csv-output", type=Path, help="Optional CSV comparison path")
    args = parser.parse_args()

    training = read_csv(args.training)
    if args.conditions_json:
        conditions = parse_conditions(args.conditions_json)
        compared = compare_conditions(training, conditions)
        report = format_conditions_report(training, compared, conditions)
    else:
        if args.feature is None or args.direction is None or args.threshold is None:
            raise ValueError("--feature, --direction, and --threshold are required unless --conditions-json is provided")
        compared = compare(training, args.feature, args.direction, args.threshold)
        report = format_report(training, compared, args.feature, args.direction, args.threshold)
    print(report, end="")
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report)
    if args.csv_output:
        write_comparison_csv(args.csv_output, compared)


if __name__ == "__main__":
    main()
