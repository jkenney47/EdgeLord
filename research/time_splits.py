from __future__ import annotations

import argparse
import csv
from collections import Counter
from datetime import datetime
from pathlib import Path


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="") as handle:
        return list(csv.DictReader(handle))


def parse_timestamp(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def count_by(rows: list[dict[str, str]], key: str) -> Counter[str]:
    return Counter(row.get(key, "") or "(blank)" for row in rows)


def split_rows(rows: list[dict[str, str]]) -> dict[str, list[dict[str, str]]]:
    dated = [(row, parse_timestamp(row.get("timestamp", ""))) for row in rows]
    dated = [(row, timestamp) for row, timestamp in dated if timestamp is not None]
    dated.sort(key=lambda item: item[1])
    total = len(dated)
    if total == 0:
        return {"train": [], "validate": [], "test": []}

    train_end = max(1, int(total * 0.6))
    validate_end = max(train_end, int(total * 0.8))
    return {
        "train": [row for row, _timestamp in dated[:train_end]],
        "validate": [row for row, _timestamp in dated[train_end:validate_end]],
        "test": [row for row, _timestamp in dated[validate_end:]],
    }


def date_range(rows: list[dict[str, str]]) -> str:
    timestamps = [timestamp for row in rows if (timestamp := parse_timestamp(row.get("timestamp", ""))) is not None]
    if not timestamps:
        return "-"
    return f"{min(timestamps).date()} to {max(timestamps).date()}"


def format_counts(counts: Counter[str]) -> str:
    if not counts:
        return "-"
    return ", ".join(f"{key}:{value}" for key, value in sorted(counts.items()))


def format_report(rows: list[dict[str, str]], splits: dict[str, list[dict[str, str]]]) -> str:
    lines = [
        "EdgeLord Time Splits",
        "====================",
        f"training_rows: {len(rows)}",
        "",
        "| Split | Rows | Date Range | Actions | Tickers | Timeframes |",
        "| --- | ---: | --- | --- | --- | --- |",
    ]

    for name in ("train", "validate", "test"):
        split = splits[name]
        lines.append(
            f"| {name} | {len(split)} | {date_range(split)} | "
            f"{format_counts(count_by(split, 'action'))} | "
            f"{format_counts(count_by(split, 'ticker'))} | "
            f"{format_counts(count_by(split, 'timeframe'))} |"
        )

    lines.extend(["", "Readiness"])
    if len(rows) < 100:
        lines.append("- Too small for meaningful walk-forward evaluation. Keep labeling.")
    elif any(len(splits[name]) == 0 for name in ("validate", "test")):
        lines.append("- Need enough dated rows to populate train, validate, and test splits.")
    else:
        lines.append("- Split scaffold is populated. Use it for early walk-forward experiments.")
    return "\n".join(lines) + "\n"


def write_split_csv(path: Path, splits: dict[str, list[dict[str, str]]]) -> None:
    rows: list[dict[str, str]] = []
    for split_name, split_rows_list in splits.items():
        for row in split_rows_list:
            rows.append({
                "split": split_name,
                "label_id": row.get("label_id", ""),
                "timestamp": row.get("timestamp", ""),
                "ticker": row.get("ticker", ""),
                "timeframe": row.get("timeframe", ""),
                "action": row.get("action", ""),
            })

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["split", "label_id", "timestamp", "ticker", "timeframe", "action"])
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Create chronological train/validate/test splits for EdgeLord training rows.")
    parser.add_argument("--training", required=True, type=Path, help="Path to training-features.csv export")
    parser.add_argument("--output", type=Path, help="Optional markdown report path")
    parser.add_argument("--csv-output", type=Path, help="Optional split assignment CSV path")
    args = parser.parse_args()

    rows = read_csv(args.training)
    splits = split_rows(rows)
    report = format_report(rows, splits)
    print(report, end="")
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report)
    if args.csv_output:
        write_split_csv(args.csv_output, splits)


if __name__ == "__main__":
    main()
