from __future__ import annotations

import argparse
import csv
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


def candidate_thresholds(values: list[float]) -> list[float]:
    unique = sorted(set(values))
    if len(unique) <= 12:
        return unique

    indexes = {
        round((len(unique) - 1) * fraction)
        for fraction in (0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9)
    }
    return [unique[index] for index in sorted(indexes)]


def score_rule(rows: list[dict[str, str]], column: str, threshold: float, direction: str) -> dict[str, float | int | str]:
    usable = [(row, numeric_value(row, column)) for row in rows]
    usable = [(row, value) for row, value in usable if value is not None]
    if not usable:
        return {}

    total_entries = sum(1 for row, _value in usable if row.get("action") == "ENTRY")
    if direction == ">=":
        matches = [(row, value) for row, value in usable if value >= threshold]
    else:
        matches = [(row, value) for row, value in usable if value <= threshold]
    if not matches:
        return {}

    entry_matches = sum(1 for row, _value in matches if row.get("action") == "ENTRY")
    base_rate = total_entries / len(usable) if usable else 0
    precision = entry_matches / len(matches)
    recall = entry_matches / total_entries if total_entries else 0
    lift = precision / base_rate if base_rate else 0
    return {
        "feature": column,
        "direction": direction,
        "threshold": threshold,
        "matched": len(matches),
        "entries": entry_matches,
        "precision": precision,
        "recall": recall,
        "lift": lift,
    }


def discover(training: list[dict[str, str]]) -> list[dict[str, float | int | str]]:
    rows = [row for row in training if row.get("action") in {"ENTRY", "SKIP"}]
    if not rows:
        return []

    feature_columns = [column for column in rows[0].keys() if column.startswith("feature_")]
    candidates: list[dict[str, float | int | str]] = []
    for column in feature_columns:
        values = [value for row in rows if (value := numeric_value(row, column)) is not None]
        if len(values) < 2:
            continue
        for threshold in candidate_thresholds(values):
            for direction in (">=", "<="):
                score = score_rule(rows, column, threshold, direction)
                if score and score["entries"]:
                    candidates.append(score)

    return sorted(
        candidates,
        key=lambda item: (float(item["lift"]), float(item["precision"]), float(item["recall"]), int(item["matched"])),
        reverse=True,
    )


def format_report(training: list[dict[str, str]], candidates: list[dict[str, float | int | str]]) -> str:
    rows = [row for row in training if row.get("action") in {"ENTRY", "SKIP"}]
    entry_count = sum(1 for row in rows if row.get("action") == "ENTRY")
    skip_count = sum(1 for row in rows if row.get("action") == "SKIP")
    lines = [
        "EdgeLord Candidate Rules",
        "========================",
        f"entry_rows: {entry_count}",
        f"skip_rows: {skip_count}",
        "",
        "Notes",
        "- These are one-feature threshold candidates, not a tested strategy.",
        "- Treat them as research prompts for human review and later walk-forward testing.",
        "- Use only replay-safe/training-eligible exports for serious analysis.",
        "",
        "Top Candidates",
    ]

    if not candidates:
        lines.append("- Need at least numeric feature coverage plus ENTRY/SKIP rows.")
        return "\n".join(lines) + "\n"

    lines.append("| Feature | Rule | Matched | Entries | Precision | Recall | Lift |")
    lines.append("| --- | --- | ---: | ---: | ---: | ---: | ---: |")
    for candidate in candidates[:25]:
        threshold = float(candidate["threshold"])
        lines.append(
            f"| {candidate['feature']} | {candidate['direction']} {threshold:.4f} | "
            f"{candidate['matched']} | {candidate['entries']} | "
            f"{float(candidate['precision']):.2f} | {float(candidate['recall']):.2f} | {float(candidate['lift']):.2f} |"
        )
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate simple EdgeLord ENTRY-vs-SKIP rule candidates.")
    parser.add_argument("--training", required=True, type=Path, help="Path to training-features.csv export")
    parser.add_argument("--output", type=Path, help="Optional path to write candidate rules markdown")
    args = parser.parse_args()

    training = read_csv(args.training)
    report = format_report(training, discover(training))
    print(report, end="")
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report)


if __name__ == "__main__":
    main()
