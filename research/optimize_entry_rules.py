from __future__ import annotations

import argparse
import csv
import json
import statistics
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


def candidate_thresholds(values: list[float]) -> list[float]:
    unique = sorted(set(values))
    if len(unique) <= 12:
        return unique
    indexes = {
        round((len(unique) - 1) * fraction)
        for fraction in (0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9)
    }
    return [unique[index] for index in sorted(indexes)]


def closed_entry_rows(training: list[dict[str, str]], trades: list[dict[str, str]]) -> list[dict[str, str]]:
    entries_by_id = {
        row.get("label_id", ""): row
        for row in training
        if row.get("action") == "ENTRY" and row.get("label_id")
    }
    eligible_exit_ids = {
        row.get("label_id", "")
        for row in training
        if row.get("action") == "EXIT" and row.get("label_id")
    }
    rows: list[dict[str, str]] = []
    for trade in trades:
        if trade.get("status") != "closed":
            continue
        entry = entries_by_id.get(trade.get("entry_label_id", ""))
        return_pct = numeric_value(trade, "return_pct")
        if not entry or trade.get("exit_label_id", "") not in eligible_exit_ids or return_pct is None:
            continue
        rows.append({
            **entry,
            "return_pct": f"{return_pct:.8g}",
            "outcome": "winner" if return_pct > 0 else "loser",
        })
    return rows


def score_rule(rows: list[dict[str, str]], feature: str, direction: str, threshold: float) -> dict[str, Any] | None:
    usable = [(row, numeric_value(row, feature)) for row in rows]
    usable = [(row, value) for row, value in usable if value is not None]
    if not usable:
        return None
    if direction == ">=":
        matches = [row for row, value in usable if value >= threshold]
    else:
        matches = [row for row, value in usable if value <= threshold]
    if not matches:
        return None

    returns = [value for row in matches if (value := numeric_value(row, "return_pct")) is not None]
    all_returns = [value for row, _feature_value in usable if (value := numeric_value(row, "return_pct")) is not None]
    if not returns or not all_returns:
        return None
    wins = sum(1 for value in returns if value > 0)
    return {
        "feature": feature,
        "direction": direction,
        "threshold": threshold,
        "matched_trades": len(returns),
        "win_rate": wins / len(returns),
        "avg_return_pct": statistics.fmean(returns),
        "median_return_pct": statistics.median(returns),
        "total_return_pct": sum(returns),
        "baseline_avg_return_pct": statistics.fmean(all_returns),
        "lift_vs_baseline_pct": statistics.fmean(returns) - statistics.fmean(all_returns),
    }


def optimize(rows: list[dict[str, str]]) -> list[dict[str, Any]]:
    if not rows:
        return []
    feature_columns = [column for column in rows[0].keys() if column.startswith("feature_")]
    candidates: list[dict[str, Any]] = []
    for feature in feature_columns:
        values = [value for row in rows if (value := numeric_value(row, feature)) is not None]
        if len(values) < 2:
            continue
        for threshold in candidate_thresholds(values):
            for direction in (">=", "<="):
                score = score_rule(rows, feature, direction, threshold)
                if score:
                    candidates.append(score)
    return sorted(
        candidates,
        key=lambda row: (
            float(row["lift_vs_baseline_pct"]),
            float(row["avg_return_pct"]),
            float(row["win_rate"]),
            int(row["matched_trades"]),
        ),
        reverse=True,
    )


def format_report(rows: list[dict[str, str]], candidates: list[dict[str, Any]]) -> str:
    returns = [value for row in rows if (value := numeric_value(row, "return_pct")) is not None]
    lines = [
        "EdgeLord Return-Optimized Entry Rules",
        "=====================================",
        f"closed_entry_rows: {len(rows)}",
        f"baseline_avg_return_pct: {statistics.fmean(returns):.2f}" if returns else "baseline_avg_return_pct: 0.00",
        "",
        "Notes",
        "- These are one-feature filters over closed labeled entries.",
        "- A trade is included only when both entry and exit labels are training rows.",
        "- They optimize labeled trade returns, not full-history backtest returns.",
        "- Treat this as a ranking prompt for later walk-forward testing.",
        "",
        "Top Candidates",
    ]
    if not rows:
        lines.append("- Need closed trades with training-eligible ENTRY and EXIT labels.")
    elif len(rows) < 5:
        lines.append("- Dataset is very small; rankings are unstable.")
    if not candidates:
        lines.append("- Need numeric feature coverage across closed entry rows.")
        return "\n".join(lines) + "\n"

    lines.append("| Feature | Rule | Trades | Win Rate | Avg Return | Lift | Total Return |")
    lines.append("| --- | --- | ---: | ---: | ---: | ---: | ---: |")
    for row in candidates[:25]:
        lines.append(
            f"| {row['feature']} | {row['direction']} {float(row['threshold']):.4f} | "
            f"{row['matched_trades']} | {float(row['win_rate']):.2f} | "
            f"{float(row['avg_return_pct']):.2f} | {float(row['lift_vs_baseline_pct']):.2f} | "
            f"{float(row['total_return_pct']):.2f} |"
        )
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Rank simple entry feature thresholds by closed-trade returns.")
    parser.add_argument("--training", required=True, type=Path, help="Path to training-features.csv export")
    parser.add_argument("--trades", required=True, type=Path, help="Path to trades.csv export")
    parser.add_argument("--output", type=Path, help="Optional markdown report path")
    parser.add_argument("--json-output", type=Path, help="Optional candidate JSON path")
    args = parser.parse_args()

    rows = closed_entry_rows(read_csv(args.training), read_csv(args.trades))
    candidates = optimize(rows)
    report = format_report(rows, candidates)
    print(report, end="")
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report)
    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(f"{json.dumps({'candidates': candidates}, indent=2)}\n")


if __name__ == "__main__":
    main()
