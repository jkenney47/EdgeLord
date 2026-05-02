from __future__ import annotations

import argparse
import csv
from collections import Counter
from pathlib import Path


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


def rule_matches(row: dict[str, str], feature: str, direction: str, threshold: float) -> bool:
    value = numeric_value(row, feature)
    if value is None:
        return False
    if direction == ">=":
        return value >= threshold
    if direction == "<=":
        return value <= threshold
    raise ValueError("direction must be >= or <=")


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


def format_report(compared: list[dict[str, str]], feature: str, direction: str, threshold: float) -> str:
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
    return "\n".join(lines) + "\n"


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
    parser.add_argument("--feature", required=True, help="Feature column, for example feature_distance_to_ema25_pct")
    parser.add_argument("--direction", required=True, choices=[">=", "<="], help="Threshold direction")
    parser.add_argument("--threshold", required=True, type=float, help="Numeric threshold")
    parser.add_argument("--output", type=Path, help="Optional markdown report path")
    parser.add_argument("--csv-output", type=Path, help="Optional CSV comparison path")
    args = parser.parse_args()

    compared = compare(read_csv(args.training), args.feature, args.direction, args.threshold)
    report = format_report(compared, args.feature, args.direction, args.threshold)
    print(report, end="")
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report)
    if args.csv_output:
        write_comparison_csv(args.csv_output, compared)


if __name__ == "__main__":
    main()
