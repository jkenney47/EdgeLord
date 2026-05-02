from __future__ import annotations

import argparse
import csv
import statistics
from collections import Counter
from pathlib import Path
from typing import Iterable


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="") as handle:
        return list(csv.DictReader(handle))


def count_by(rows: Iterable[dict[str, str]], key: str) -> Counter[str]:
    return Counter(row.get(key, "") or "(blank)" for row in rows)


def print_counts(title: str, counts: Counter[str]) -> None:
    print(f"\n{title}")
    if not counts:
        print("  none")
        return
    for value, count in counts.most_common():
        print(f"  {value}: {count}")


def pct(value: int, total: int) -> str:
    if total == 0:
        return "0.0%"
    return f"{(value / total) * 100:.1f}%"


def numeric_values(rows: Iterable[dict[str, str]], key: str) -> list[float]:
    values: list[float] = []
    for row in rows:
        raw = row.get(key, "")
        if raw == "":
            continue
        try:
            values.append(float(raw))
        except ValueError:
            continue
    return values


def print_return_summary(trades: list[dict[str, str]]) -> None:
    returns = numeric_values((trade for trade in trades if trade.get("status") == "closed"), "return_pct")
    print("\nClosed Trade Returns")
    if not returns:
        print("  none")
        return
    wins = sum(1 for value in returns if value > 0)
    print(f"  count: {len(returns)}")
    print(f"  win_rate: {pct(wins, len(returns))}")
    print(f"  avg_return_pct: {statistics.fmean(returns):.2f}")
    print(f"  median_return_pct: {statistics.median(returns):.2f}")
    print(f"  min_return_pct: {min(returns):.2f}")
    print(f"  max_return_pct: {max(returns):.2f}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Report EdgeLord label/trade/training dataset readiness.")
    parser.add_argument("--labels", required=True, type=Path, help="Path to labels.csv export")
    parser.add_argument("--training", required=True, type=Path, help="Path to training-features.csv export")
    parser.add_argument("--trades", required=True, type=Path, help="Path to trades.csv export")
    args = parser.parse_args()

    labels = read_csv(args.labels)
    training = read_csv(args.training)
    trades = read_csv(args.trades)

    eligible_labels = [label for label in labels if label.get("training_eligible") == "1"]
    excluded_labels = [label for label in labels if label.get("training_eligible") != "1"]
    orphan_exits = [
        label for label in labels
        if label.get("action") == "EXIT" and (not label.get("trade_id") or not label.get("parent_entry_label_id"))
    ]
    entries_without_trade = [
        label for label in labels
        if label.get("action") == "ENTRY" and not label.get("trade_id")
    ]

    print("EdgeLord Dataset Report")
    print("=======================")
    print(f"labels: {len(labels)}")
    print(f"training_rows: {len(training)}")
    print(f"training_eligible_labels: {len(eligible_labels)}")
    print(f"excluded_labels: {len(excluded_labels)}")
    print(f"trades: {len(trades)}")
    print(f"orphan_exits: {len(orphan_exits)}")
    print(f"entries_without_trade: {len(entries_without_trade)}")

    print_counts("Actions", count_by(labels, "action"))
    print_counts("Training Actions", count_by(training, "action"))
    print_counts("Label Sources", count_by(labels, "label_source"))
    print_counts("Tickers", count_by(labels, "ticker"))
    print_counts("Timeframes", count_by(labels, "timeframe"))
    print_counts("Trade Status", count_by(trades, "status"))
    print_return_summary(trades)

    print("\nReadiness")
    entry_count = count_by(training, "action").get("ENTRY", 0)
    skip_count = count_by(training, "action").get("SKIP", 0)
    exit_count = count_by(training, "action").get("EXIT", 0)
    if entry_count < 100:
        print(f"  entry labels are still early: {entry_count}/100 rough-mining target")
    else:
        print(f"  entry labels reached rough-mining target: {entry_count}")
    if skip_count < entry_count:
        print(f"  add more SKIP examples near tempting setups: {skip_count} skips vs {entry_count} entries")
    else:
        print(f"  skip coverage is at least entry-sized: {skip_count} skips vs {entry_count} entries")
    if exit_count < entry_count:
        print(f"  exits are behind entries: {exit_count} exits vs {entry_count} entries")
    if orphan_exits or entries_without_trade:
        print("  fix orphan trade links before modeling")
    if excluded_labels:
        print("  excluded labels are present; keep them out of training unless intentionally studying hindsight")


if __name__ == "__main__":
    main()
