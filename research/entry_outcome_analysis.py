from __future__ import annotations

import argparse
import csv
import statistics
from pathlib import Path


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


def joined_closed_entries(training: list[dict[str, str]], trades: list[dict[str, str]]) -> list[dict[str, str]]:
    entries_by_id = {
        row.get("label_id", ""): row
        for row in training
        if row.get("action") == "ENTRY" and row.get("label_id")
    }
    joined: list[dict[str, str]] = []
    for trade in trades:
        if trade.get("status") != "closed":
            continue
        entry = entries_by_id.get(trade.get("entry_label_id", ""))
        if not entry:
            continue
        return_pct = numeric_value(trade, "return_pct")
        if return_pct is None:
            continue
        joined.append({
            **entry,
            "return_pct": f"{return_pct:.8g}",
            "outcome": "winner" if return_pct > 0 else "loser",
            "exit_label_id": trade.get("exit_label_id", ""),
            "exit_timestamp": trade.get("exit_timestamp", ""),
            "exit_price": trade.get("exit_price", ""),
        })
    return joined


def feature_contrasts(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    if not rows:
        return []
    feature_columns = [column for column in rows[0].keys() if column.startswith("feature_")]
    winners = [row for row in rows if row.get("outcome") == "winner"]
    losers = [row for row in rows if row.get("outcome") == "loser"]
    contrasts: list[dict[str, str]] = []
    for column in feature_columns:
        winner_values = [value for row in winners if (value := numeric_value(row, column)) is not None]
        loser_values = [value for row in losers if (value := numeric_value(row, column)) is not None]
        if not winner_values or not loser_values:
            continue
        winner_mean = statistics.fmean(winner_values)
        loser_mean = statistics.fmean(loser_values)
        contrasts.append({
            "feature": column,
            "winner_mean": f"{winner_mean:.8g}",
            "loser_mean": f"{loser_mean:.8g}",
            "delta": f"{winner_mean - loser_mean:.8g}",
            "winner_count": str(len(winner_values)),
            "loser_count": str(len(loser_values)),
        })
    return sorted(contrasts, key=lambda row: abs(float(row["delta"])), reverse=True)


def format_report(rows: list[dict[str, str]], contrasts: list[dict[str, str]]) -> str:
    returns = [value for row in rows if (value := numeric_value(row, "return_pct")) is not None]
    winners = [row for row in rows if row.get("outcome") == "winner"]
    losers = [row for row in rows if row.get("outcome") == "loser"]
    lines = [
        "EdgeLord Entry Outcome Analysis",
        "================================",
        f"closed_entry_rows: {len(rows)}",
        f"winners: {len(winners)}",
        f"losers: {len(losers)}",
    ]
    if returns:
        lines.extend([
            f"avg_return_pct: {statistics.fmean(returns):.2f}",
            f"median_return_pct: {statistics.median(returns):.2f}",
        ])
    lines.extend([
        "",
        "Notes",
        "- This compares entry-time features on closed trades only.",
        "- It is an optimizer scaffold, not a complete backtest.",
        "- Use it to see what differs between winning and losing labeled entries.",
        "",
        "Top Winner vs Loser Entry Feature Differences",
    ])
    if not rows:
        lines.append("- Need closed trades with training-eligible ENTRY labels.")
    elif not winners or not losers:
        lines.append("- Need at least one winning and one losing closed trade for contrasts.")
    elif not contrasts:
        lines.append("- No numeric feature overlap between winners and losers.")
    else:
        lines.append("| Feature | Winner Mean | Loser Mean | Delta | N Winner | N Loser |")
        lines.append("| --- | ---: | ---: | ---: | ---: | ---: |")
        for row in contrasts[:25]:
            lines.append(
                f"| {row['feature']} | {row['winner_mean']} | {row['loser_mean']} | "
                f"{row['delta']} | {row['winner_count']} | {row['loser_count']} |"
            )
    return "\n".join(lines) + "\n"


def write_joined_csv(path: Path, rows: list[dict[str, str]]) -> None:
    columns = [
        "label_id", "ticker", "timeframe", "timestamp", "trade_id", "chart_price",
        "exit_label_id", "exit_timestamp", "exit_price", "return_pct", "outcome"
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow({column: row.get(column, "") for column in columns})


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare entry-time features for winning vs losing EdgeLord trades.")
    parser.add_argument("--training", required=True, type=Path, help="Path to training-features.csv export")
    parser.add_argument("--trades", required=True, type=Path, help="Path to trades.csv export")
    parser.add_argument("--output", type=Path, help="Optional markdown report path")
    parser.add_argument("--csv-output", type=Path, help="Optional joined closed-entry CSV path")
    args = parser.parse_args()

    rows = joined_closed_entries(read_csv(args.training), read_csv(args.trades))
    contrasts = feature_contrasts(rows)
    report = format_report(rows, contrasts)
    print(report, end="")
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report)
    if args.csv_output:
        write_joined_csv(args.csv_output, rows)


if __name__ == "__main__":
    main()
