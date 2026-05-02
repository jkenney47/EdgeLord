from __future__ import annotations

import argparse
from collections import Counter

from load_dataset import is_training_eligible, load_rows, sort_key, value


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a first walk-forward dataset split sanity check.")
    parser.add_argument("dataset", help="Path to CSV, JSON, or JSONL export")
    parser.add_argument("--train", type=float, default=0.6, help="Train fraction by time order")
    parser.add_argument("--validate", type=float, default=0.2, help="Validation fraction by time order")
    args = parser.parse_args()

    rows = sorted((row for row in load_rows(args.dataset) if is_training_eligible(row)), key=sort_key)
    if not rows:
        print("No training-eligible rows found.")
        return

    train_end = int(len(rows) * args.train)
    validate_end = train_end + int(len(rows) * args.validate)
    splits = {
        "train": rows[:train_end],
        "validate": rows[train_end:validate_end],
        "test": rows[validate_end:],
    }

    for name, split_rows in splits.items():
        labels = Counter(str(value(row, "labelType", "label_type", default="UNKNOWN")) for row in split_rows)
        first = value(split_rows[0], "timestamp", default="") if split_rows else ""
        last = value(split_rows[-1], "timestamp", default="") if split_rows else ""
        print(f"{name}: rows={len(split_rows)} first={first} last={last} labels={dict(sorted(labels.items()))}")

    entries = [row for row in rows if str(value(row, "labelType", "label_type")).upper() == "ENTRY"]
    exits = [row for row in rows if str(value(row, "labelType", "label_type")).upper() == "EXIT"]
    skips = [row for row in rows if str(value(row, "labelType", "label_type")).upper() == "SKIP"]
    print(f"entry_exit_skip: entries={len(entries)} exits={len(exits)} skips={len(skips)}")
    if len(rows) < 300:
        print(f"gate: blocked, need {300 - len(rows)} more training-eligible labels before serious evaluation")


if __name__ == "__main__":
    main()
