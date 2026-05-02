from __future__ import annotations

import argparse
from collections import Counter

from load_dataset import is_replay_safe, is_training_eligible, load_rows, value


def main() -> None:
    parser = argparse.ArgumentParser(description="Summarize EdgeLord label exports.")
    parser.add_argument("dataset", help="Path to CSV, JSON, or JSONL export")
    args = parser.parse_args()

    rows = load_rows(args.dataset)
    replay_safe = [row for row in rows if is_replay_safe(row)]
    training_eligible = [row for row in rows if is_training_eligible(row)]

    by_type = Counter(str(value(row, "labelType", "label_type", default="UNKNOWN")) for row in rows)
    by_replay_type = Counter(str(value(row, "labelType", "label_type", default="UNKNOWN")) for row in replay_safe)
    by_source = Counter(str(value(row, "labelSource", "label_source", default="unknown")) for row in rows)
    by_ticker_timeframe = Counter(
        (
            str(value(row, "ticker", default="UNKNOWN")),
            str(value(row, "timeframe", default="UNKNOWN")),
        )
        for row in rows
    )
    missing_trade_links = [
        row
        for row in rows
        if str(value(row, "labelType", "label_type")).upper() == "EXIT"
        and not value(row, "tradeId", "trade_id", "parentLabelId", "parent_label_id")
    ]

    print(f"rows: {len(rows)}")
    print(f"replay_safe_rows: {len(replay_safe)}")
    print(f"training_eligible_rows: {len(training_eligible)}")
    print("label_counts:")
    for label_type, count in sorted(by_type.items()):
        print(f"  {label_type}: {count}")
    print("replay_safe_label_counts:")
    for label_type, count in sorted(by_replay_type.items()):
        print(f"  {label_type}: {count}")
    print("label_source_counts:")
    for label_source, count in sorted(by_source.items()):
        print(f"  {label_source}: {count}")
    print("ticker_timeframe_counts:")
    for (ticker, timeframe), count in sorted(by_ticker_timeframe.items()):
        print(f"  {ticker} {timeframe}: {count}")
    print(f"missing_exit_links: {len(missing_trade_links)}")

    if len(training_eligible) < 300:
        print(f"gate: blocked, need {300 - len(training_eligible)} more training-eligible labels")
    else:
        print("gate: passed, enough training-eligible labels for first rule-discovery pass")


if __name__ == "__main__":
    main()
