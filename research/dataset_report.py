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


def format_counts(title: str, counts: Counter[str]) -> list[str]:
    lines = [f"\n{title}"]
    if not counts:
        return [*lines, "  none"]
    for value, count in counts.most_common():
        lines.append(f"  {value}: {count}")
    return lines


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


def format_return_summary(trades: list[dict[str, str]]) -> list[str]:
    returns = numeric_values((trade for trade in trades if trade.get("status") == "closed"), "return_pct")
    lines = ["\nClosed Trade Returns"]
    if not returns:
        return [*lines, "  none"]
    wins = sum(1 for value in returns if value > 0)
    lines.append(f"  count: {len(returns)}")
    lines.append(f"  win_rate: {pct(wins, len(returns))}")
    lines.append(f"  avg_return_pct: {statistics.fmean(returns):.2f}")
    lines.append(f"  median_return_pct: {statistics.median(returns):.2f}")
    lines.append(f"  min_return_pct: {min(returns):.2f}")
    lines.append(f"  max_return_pct: {max(returns):.2f}")
    return lines


def missing_count(rows: Iterable[dict[str, str]], key: str) -> int:
    return sum(1 for row in rows if row.get(key, "") == "")


def format_feature_coverage(training: list[dict[str, str]]) -> list[str]:
    feature_columns = [column for column in training[0].keys() if column.startswith("feature_")] if training else []
    lines = ["\nFeature Coverage"]
    if not feature_columns:
        return [*lines, "  none"]

    missing = [(column, missing_count(training, column)) for column in feature_columns]
    fully_populated = sum(1 for _column, count in missing if count == 0)
    lines.append(f"  feature_columns: {len(feature_columns)}")
    lines.append(f"  fully_populated: {fully_populated}")

    sparse = [(column, count) for column, count in missing if count > 0]
    if sparse:
        lines.append("  most_missing:")
        for column, count in sorted(sparse, key=lambda item: item[1], reverse=True)[:10]:
            lines.append(f"    {column}: {count} missing ({pct(count, len(training))})")
    else:
        lines.append("  missing_values: none")
    return lines


def format_feature_contrasts(training: list[dict[str, str]]) -> list[str]:
    lines = ["\nEntry vs Skip Feature Contrasts"]
    feature_columns = [column for column in training[0].keys() if column.startswith("feature_")] if training else []
    entries = [row for row in training if row.get("action") == "ENTRY"]
    skips = [row for row in training if row.get("action") == "SKIP"]
    if not feature_columns:
        return [*lines, "  none"]
    if not entries or not skips:
        return [*lines, "  needs at least one ENTRY and one SKIP training row"]

    contrasts: list[tuple[str, float, float, float, int, int]] = []
    for column in feature_columns:
        entry_values = numeric_values(entries, column)
        skip_values = numeric_values(skips, column)
        if not entry_values or not skip_values:
            continue
        entry_mean = statistics.fmean(entry_values)
        skip_mean = statistics.fmean(skip_values)
        contrasts.append((column, entry_mean - skip_mean, entry_mean, skip_mean, len(entry_values), len(skip_values)))

    if not contrasts:
        return [*lines, "  no numeric feature overlap between ENTRY and SKIP rows"]

    lines.append("  top_absolute_mean_differences:")
    for column, delta, entry_mean, skip_mean, entry_count, skip_count in sorted(contrasts, key=lambda item: abs(item[1]), reverse=True)[:12]:
        lines.append(
            f"    {column}: entry_mean={entry_mean:.4f}, skip_mean={skip_mean:.4f}, "
            f"delta={delta:.4f}, n={entry_count}/{skip_count}"
        )
    return lines


def next_label_recommendations(
    labels: list[dict[str, str]],
    training: list[dict[str, str]],
    trades: list[dict[str, str]],
    orphan_exits: list[dict[str, str]],
    entries_without_trade: list[dict[str, str]],
) -> list[str]:
    training_actions = count_by(training, "action")
    training_tickers = count_by(training, "ticker")
    training_timeframes = count_by(training, "timeframe")
    entries = training_actions.get("ENTRY", 0)
    exits = training_actions.get("EXIT", 0)
    skips = training_actions.get("SKIP", 0)
    closed = count_by(trades, "status").get("closed", 0)
    excluded = len([label for label in labels if label.get("training_eligible") != "1"])

    lines = ["\nWhat To Label Next"]
    if orphan_exits or entries_without_trade:
        lines.append("  1. Fix orphan trade links before adding modeling labels.")
        return lines
    if entries == 0:
        lines.append("  1. Start with replay-safe ENTRY labels on SOXL/SOXS 4H setups.")
        lines.append("  2. Add explicit SKIP labels near setups you considered but rejected.")
        lines.append("  3. Pair every ENTRY with an explicit EXIT when the trade idea ends.")
        return lines
    if exits < entries:
        lines.append(f"  1. Add EXIT labels for open/unfinished ideas: {exits} exits vs {entries} entries.")
    if skips < entries:
        lines.append(f"  2. Add SKIP labels near tempting setups: {skips} skips vs {entries} entries.")
    if closed < max(1, entries // 2):
        lines.append(f"  3. Complete more closed trades for return analysis: {closed} closed trades.")
    if training_tickers:
        weakest_ticker = min(training_tickers.items(), key=lambda item: item[1])
        lines.append(f"  4. Balance ticker coverage if relevant: {weakest_ticker[0]} has {weakest_ticker[1]} training rows.")
    if training_timeframes:
        weakest_timeframe = min(training_timeframes.items(), key=lambda item: item[1])
        lines.append(f"  5. Balance timeframe coverage if relevant: {weakest_timeframe[0]} has {weakest_timeframe[1]} training rows.")
    if excluded:
        lines.append(f"  6. Review excluded labels before modeling: {excluded} excluded rows.")
    if len(lines) == 1:
        lines.append("  1. Keep labeling replay-safe entries, exits, and skips until at least 300 decision rows exist.")
    return lines


def main() -> None:
    parser = argparse.ArgumentParser(description="Report EdgeLord label/trade/training dataset readiness.")
    parser.add_argument("--labels", required=True, type=Path, help="Path to labels.csv export")
    parser.add_argument("--training", required=True, type=Path, help="Path to training-features.csv export")
    parser.add_argument("--trades", required=True, type=Path, help="Path to trades.csv export")
    parser.add_argument("--output", type=Path, help="Optional path to write the report as markdown/plain text")
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

    lines = [
        "EdgeLord Dataset Report",
        "=======================",
        f"labels: {len(labels)}",
        f"training_rows: {len(training)}",
        f"training_eligible_labels: {len(eligible_labels)}",
        f"excluded_labels: {len(excluded_labels)}",
        f"trades: {len(trades)}",
        f"orphan_exits: {len(orphan_exits)}",
        f"entries_without_trade: {len(entries_without_trade)}",
    ]

    lines.extend(format_counts("Actions", count_by(labels, "action")))
    lines.extend(format_counts("Training Actions", count_by(training, "action")))
    lines.extend(format_counts("Label Sources", count_by(labels, "label_source")))
    lines.extend(format_counts("Training Label Sources", count_by(training, "label_source")))
    lines.extend(format_counts("Training Capture Modes", count_by(training, "capture_mode")))
    lines.extend(format_counts("Tickers", count_by(labels, "ticker")))
    lines.extend(format_counts("Timeframes", count_by(labels, "timeframe")))
    lines.extend(format_counts("Trade Status", count_by(trades, "status")))
    lines.extend(format_return_summary(trades))
    lines.extend(format_feature_coverage(training))
    lines.extend(format_feature_contrasts(training))

    lines.append("\nReadiness")
    entry_count = count_by(training, "action").get("ENTRY", 0)
    skip_count = count_by(training, "action").get("SKIP", 0)
    exit_count = count_by(training, "action").get("EXIT", 0)
    if entry_count < 100:
        lines.append(f"  entry labels are still early: {entry_count}/100 rough-mining target")
    else:
        lines.append(f"  entry labels reached rough-mining target: {entry_count}")
    if skip_count < entry_count:
        lines.append(f"  add more SKIP examples near tempting setups: {skip_count} skips vs {entry_count} entries")
    else:
        lines.append(f"  skip coverage is at least entry-sized: {skip_count} skips vs {entry_count} entries")
    if exit_count < entry_count:
        lines.append(f"  exits are behind entries: {exit_count} exits vs {entry_count} entries")
    if orphan_exits or entries_without_trade:
        lines.append("  fix orphan trade links before modeling")
    if excluded_labels:
        lines.append("  excluded labels are present; keep them out of training unless intentionally studying hindsight")

    lines.extend(next_label_recommendations(labels, training, trades, orphan_exits, entries_without_trade))

    report = "\n".join(lines) + "\n"
    print(report, end="")
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report)


if __name__ == "__main__":
    main()
