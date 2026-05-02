from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


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


Rule = dict[str, Any]


def score_rule(rows: list[dict[str, str]], column: str, threshold: float, direction: str) -> Rule:
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


def rule_matches(row: dict[str, str], rule: Rule) -> bool:
    value = numeric_value(row, str(rule["feature"]))
    if value is None:
        return False
    if rule["direction"] == ">=":
        return value >= float(rule["threshold"])
    return value <= float(rule["threshold"])


def score_rule_pair(rows: list[dict[str, str]], left: Rule, right: Rule) -> Rule:
    usable = [
        row for row in rows
        if numeric_value(row, str(left["feature"])) is not None and numeric_value(row, str(right["feature"])) is not None
    ]
    if not usable:
        return {}

    total_entries = sum(1 for row in usable if row.get("action") == "ENTRY")
    matches = [row for row in usable if rule_matches(row, left) and rule_matches(row, right)]
    if not matches:
        return {}

    entry_matches = sum(1 for row in matches if row.get("action") == "ENTRY")
    base_rate = total_entries / len(usable) if usable else 0
    precision = entry_matches / len(matches)
    recall = entry_matches / total_entries if total_entries else 0
    lift = precision / base_rate if base_rate else 0
    return {
        "conditions": [
            {"feature": left["feature"], "direction": left["direction"], "threshold": left["threshold"]},
            {"feature": right["feature"], "direction": right["direction"], "threshold": right["threshold"]},
        ],
        "matched": len(matches),
        "entries": entry_matches,
        "precision": precision,
        "recall": recall,
        "lift": lift,
    }


def sorted_candidates(candidates: list[Rule]) -> list[Rule]:
    return sorted(
        candidates,
        key=lambda item: (float(item["lift"]), float(item["precision"]), float(item["recall"]), int(item["matched"])),
        reverse=True,
    )


def discover(training: list[dict[str, str]]) -> tuple[list[Rule], list[Rule]]:
    rows = [row for row in training if row.get("action") in {"ENTRY", "SKIP"}]
    if not rows:
        return [], []

    feature_columns = [column for column in rows[0].keys() if column.startswith("feature_")]
    candidates: list[Rule] = []
    for column in feature_columns:
        values = [value for row in rows if (value := numeric_value(row, column)) is not None]
        if len(values) < 2:
            continue
        for threshold in candidate_thresholds(values):
            for direction in (">=", "<="):
                score = score_rule(rows, column, threshold, direction)
                if score and score["entries"]:
                    candidates.append(score)

    singles = sorted_candidates(candidates)
    pairs = discover_pairs(rows, singles)
    return singles, pairs


def discover_pairs(rows: list[dict[str, str]], singles: list[Rule]) -> list[Rule]:
    if len(singles) < 2:
        return []

    pair_candidates: list[Rule] = []
    seen: set[tuple[str, str, str, str, float, float]] = set()
    search_pool = singles[:40]
    for left_index, left in enumerate(search_pool):
        for right in search_pool[left_index + 1:]:
            left_feature = str(left["feature"])
            right_feature = str(right["feature"])
            if left_feature == right_feature:
                continue
            feature_a, feature_b = sorted([left_feature, right_feature])
            key = (
                feature_a,
                feature_b,
                str(left["direction"]),
                str(right["direction"]),
                float(left["threshold"]),
                float(right["threshold"]),
            )
            if key in seen:
                continue
            seen.add(key)
            score = score_rule_pair(rows, left, right)
            if score and score["entries"]:
                pair_candidates.append(score)
    return sorted_candidates(pair_candidates)


def format_report(training: list[dict[str, str]], candidates: list[Rule], pair_candidates: list[Rule]) -> str:
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

    lines.extend(["", "Top Pair Candidates"])
    if not pair_candidates:
        lines.append("- Need enough one-feature candidates across at least two features.")
        return "\n".join(lines) + "\n"

    lines.append("| Rule | Matched | Entries | Precision | Recall | Lift |")
    lines.append("| --- | ---: | ---: | ---: | ---: | ---: |")
    for candidate in pair_candidates[:25]:
        conditions = [
            f"{condition['feature']} {condition['direction']} {float(condition['threshold']):.4f}"
            for condition in candidate["conditions"]
        ]
        lines.append(
            f"| {' AND '.join(conditions)} | {candidate['matched']} | {candidate['entries']} | "
            f"{float(candidate['precision']):.2f} | {float(candidate['recall']):.2f} | {float(candidate['lift']):.2f} |"
        )
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate simple EdgeLord ENTRY-vs-SKIP rule candidates.")
    parser.add_argument("--training", required=True, type=Path, help="Path to training-features.csv export")
    parser.add_argument("--output", type=Path, help="Optional path to write candidate rules markdown")
    parser.add_argument("--json-output", type=Path, help="Optional path to write candidate rules JSON")
    args = parser.parse_args()

    training = read_csv(args.training)
    candidates, pair_candidates = discover(training)
    report = format_report(training, candidates, pair_candidates)
    print(report, end="")
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report)
    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(f"{json.dumps({'candidates': candidates, 'pairCandidates': pair_candidates}, indent=2)}\n")


if __name__ == "__main__":
    main()
