from __future__ import annotations

import argparse
import csv
import sys

from load_dataset import is_training_eligible, load_rows, sort_key, value


def row_key(row: dict[str, object]) -> tuple[str, str, str]:
    return (
        str(value(row, "timestamp", default="")),
        str(value(row, "ticker", default="")),
        str(value(row, "timeframe", default="")),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare human labels against model signal rows.")
    parser.add_argument("labels", help="Human label export")
    parser.add_argument("model_signals", help="CSV/JSON/JSONL rows with timestamp, ticker, timeframe, and model_action")
    parser.add_argument("--include-ineligible", action="store_true", help="Include labels excluded from training")
    args = parser.parse_args()

    labels = sorted(load_rows(args.labels), key=sort_key)
    if not args.include_ineligible:
        labels = [row for row in labels if is_training_eligible(row)]
    signals = {row_key(row): row for row in load_rows(args.model_signals)}

    fieldnames = [
        "timestamp",
        "ticker",
        "timeframe",
        "human_action",
        "model_action",
        "category",
        "label_source",
        "human_label_id",
    ]
    writer = csv.DictWriter(sys.stdout, fieldnames=fieldnames)
    writer.writeheader()

    seen: set[tuple[str, str, str]] = set()
    for label in labels:
        key = row_key(label)
        seen.add(key)
        human_action = str(value(label, "labelType", "label_type", default="SKIP")).upper()
        signal = signals.get(key, {})
        model_action = str(value(signal, "model_action", "signal", "action", default="SKIP")).upper()
        if human_action == model_action:
            category = f"both_{human_action.lower()}"
        elif human_action == "ENTRY" and model_action == "SKIP":
            category = "human_entered_model_skipped"
        elif human_action == "SKIP" and model_action == "ENTRY":
            category = "model_entered_human_skipped"
        else:
            category = "different_action"

        writer.writerow(
            {
                "timestamp": key[0],
                "ticker": key[1],
                "timeframe": key[2],
                "human_action": human_action,
                "model_action": model_action,
                "category": category,
                "label_source": value(label, "labelSource", "label_source", default=""),
                "human_label_id": value(label, "id", "label_id", default=""),
            }
        )

    for key, signal in sorted(signals.items()):
        if key in seen:
            continue
        model_action = str(value(signal, "model_action", "signal", "action", default="SKIP")).upper()
        if model_action == "SKIP":
            continue
        writer.writerow(
            {
                "timestamp": key[0],
                "ticker": key[1],
                "timeframe": key[2],
                "human_action": "UNLABELED",
                "model_action": model_action,
                "category": "model_signal_unlabeled",
                "label_source": "",
                "human_label_id": "",
            }
        )


if __name__ == "__main__":
    main()
