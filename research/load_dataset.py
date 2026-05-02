from __future__ import annotations

import csv
import json
from io import StringIO
from pathlib import Path
from typing import Any


Row = dict[str, Any]


def load_rows(path: str | Path) -> list[Row]:
    source = Path(path)
    suffix = source.suffix.lower()

    if suffix == ".csv":
        with source.open(newline="", encoding="utf-8") as handle:
            return [dict(row) for row in csv.DictReader(handle)]

    if suffix == ".jsonl":
        rows: list[Row] = []
        with source.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if line:
                    rows.append(json.loads(line))
        return rows

    if suffix == ".json":
        with source.open(encoding="utf-8") as handle:
            payload = json.load(handle)
        if isinstance(payload, dict) and isinstance(payload.get("events"), list):
            return [dict(row) for row in payload["events"]]
        if isinstance(payload, list):
            return [dict(row) for row in payload]
        raise ValueError("JSON input must be a list or an object with an events list")

    if suffix == "":
        return load_rows_from_text(source.read_text(encoding="utf-8"))

    raise ValueError(f"Unsupported dataset format: {source.suffix}")


def load_rows_from_text(text: str) -> list[Row]:
    stripped = text.lstrip()
    if not stripped:
        return []

    if stripped.startswith("{") or stripped.startswith("["):
        payload = json.loads(text)
        if isinstance(payload, dict) and isinstance(payload.get("events"), list):
            return [dict(row) for row in payload["events"]]
        if isinstance(payload, list):
            return [dict(row) for row in payload]
        return [dict(payload)]

    lines = [line for line in text.splitlines() if line.strip()]
    if lines and all(line.lstrip().startswith("{") for line in lines):
        return [json.loads(line) for line in lines]

    return [dict(row) for row in csv.DictReader(StringIO(text))]


def value(row: Row, *keys: str, default: Any = "") -> Any:
    for key in keys:
        if key in row and row[key] not in (None, ""):
            return row[key]
    return default


def is_replay_safe(row: Row) -> bool:
    capture_mode = str(value(row, "captureMode", "capture_mode")).lower()
    leakage = str(value(row, "potentialVisualLeakage", "potential_visual_leakage", default="false")).lower()
    return capture_mode == "replay" and leakage not in {"1", "true", "yes"}


def is_training_eligible(row: Row) -> bool:
    explicit = value(row, "trainingEligible", "training_eligible", default=None)
    if explicit is not None:
        return str(explicit).lower() in {"1", "true", "yes"}

    source = str(value(row, "labelSource", "label_source", default="")).lower()
    return is_replay_safe(row) and source in {"actual_trade", "retrospective_replay", ""}


def sort_key(row: Row) -> tuple[str, str, str]:
    return (
        str(value(row, "timestamp", default="")),
        str(value(row, "ticker", default="")),
        str(value(row, "timeframe", default="")),
    )
