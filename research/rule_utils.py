from __future__ import annotations

import csv
import json
from collections import Counter
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


def rule_matches(row: dict[str, str], feature: str, direction: str, threshold: float) -> bool:
    value = numeric_value(row, feature)
    if value is None:
        return False
    if direction == ">=":
        return value >= threshold
    if direction == "<=":
        return value <= threshold
    raise ValueError("direction must be >= or <=")


def parse_conditions(raw: str) -> list[dict[str, Any]]:
    conditions = json.loads(raw)
    if not isinstance(conditions, list) or not conditions:
        raise ValueError("--conditions-json must be a non-empty JSON array")
    return conditions


def conditions_match(row: dict[str, str], conditions: list[dict[str, Any]]) -> bool:
    return all(
        rule_matches(row, str(condition["feature"]), str(condition["direction"]), float(condition["threshold"]))
        for condition in conditions
    )


def condition_label(conditions: list[dict[str, Any]]) -> str:
    return " AND ".join(
        f"{condition['feature']} {condition['direction']} {float(condition['threshold']):.4f}"
        for condition in conditions
    )


def condition_values(row: dict[str, str], conditions: list[dict[str, Any]]) -> str:
    return "; ".join(f"{condition['feature']}={row.get(str(condition['feature']), '')}" for condition in conditions)


def classification_metrics(rows: list[dict[str, str]], model_enters_for_row) -> dict[str, float | int]:
    usable = [row for row in rows if row.get("action") in {"ENTRY", "SKIP"}]
    if not usable:
        return {
            "rows": 0,
            "human_entries": 0,
            "model_entries": 0,
            "true_positive": 0,
            "false_positive": 0,
            "false_negative": 0,
            "true_negative": 0,
            "precision": 0,
            "recall": 0,
            "agreement": 0,
        }

    counts: Counter[str] = Counter()
    for row in usable:
        human_entry = row.get("action") == "ENTRY"
        model_entry = model_enters_for_row(row)
        if human_entry and model_entry:
            counts["true_positive"] += 1
        elif not human_entry and model_entry:
            counts["false_positive"] += 1
        elif human_entry and not model_entry:
            counts["false_negative"] += 1
        else:
            counts["true_negative"] += 1

    true_positive = counts["true_positive"]
    false_positive = counts["false_positive"]
    false_negative = counts["false_negative"]
    true_negative = counts["true_negative"]
    model_entries = true_positive + false_positive
    human_entries = true_positive + false_negative
    return {
        "rows": len(usable),
        "human_entries": human_entries,
        "model_entries": model_entries,
        "true_positive": true_positive,
        "false_positive": false_positive,
        "false_negative": false_negative,
        "true_negative": true_negative,
        "precision": true_positive / model_entries if model_entries else 0,
        "recall": true_positive / human_entries if human_entries else 0,
        "agreement": (true_positive + true_negative) / len(usable),
    }
