from __future__ import annotations

import argparse
from collections import Counter
from typing import Any

from load_dataset import is_training_eligible, load_rows, value


FEATURE_PREFIXES = (
    "decision",
    "d1",
    "h4",
    "h2",
    "paired",
    "pairRatio",
)


def is_feature(key: str, val: Any) -> bool:
    return key.startswith(FEATURE_PREFIXES) and val not in (None, "")


def main() -> None:
    parser = argparse.ArgumentParser(description="Print simple entry feature frequencies.")
    parser.add_argument("dataset", help="Path to CSV, JSON, or JSONL export")
    parser.add_argument("--top", type=int, default=25, help="Number of feature states to print")
    args = parser.parse_args()

    rows = [row for row in load_rows(args.dataset) if is_training_eligible(row)]
    entries = [row for row in rows if str(value(row, "labelType", "label_type")).upper() == "ENTRY"]
    skips = [row for row in rows if str(value(row, "labelType", "label_type")).upper() == "SKIP"]

    print(f"training_eligible_rows: {len(rows)}")
    print(f"entries: {len(entries)}")
    print(f"skips: {len(skips)}")
    if not entries:
        print("No training-eligible ENTRY labels found.")
        return

    states: Counter[str] = Counter()
    for row in entries:
        for key, val in row.items():
            if is_feature(key, val):
                states[f"{key}={val}"] += 1

    print("top_entry_feature_states:")
    for state, count in states.most_common(args.top):
        print(f"  {count}: {state}")

    if len(skips) == 0:
        print("warning: no SKIP labels found; rule discovery has weak negative examples")


if __name__ == "__main__":
    main()
