from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path
from statistics import median
from typing import Any

from load_dataset import is_training_eligible, load_rows, sort_key, value


NUMERIC_FEATURES = (
    "decisionDistanceToEma25Percent",
    "decisionDistanceToSma100Percent",
    "decisionDistanceToMonthlyVwapPercent",
    "decisionAtr14RmaPctOfClose",
    "decisionStochRsiKAboveD",
    "decisionStochRsiOverbought",
    "decisionStochRsiOversold",
    "decisionRecent5ReturnPercent",
    "decisionRecent10ReturnPercent",
    "decisionRecent20ReturnPercent",
    "pairedReturn1Percent",
    "pairRatioReturn5Percent",
    "pairRatioReturn10Percent",
)

STATE_FEATURES = (
    "ticker",
    "timeframe",
    "decisionCloseAboveEma25",
    "decisionCloseAboveSma100",
    "decisionCloseAboveMonthlyVwap",
    "decisionCmWvfSignalState",
    "pairedContextMissing",
    "pairDivergenceFlag",
)


def label_type(row: dict[str, Any]) -> str:
    return str(value(row, "labelType", "label_type", default="UNKNOWN")).upper()


def as_number(raw: Any) -> float | None:
    if raw in (None, ""):
        return None
    if isinstance(raw, bool):
        return 1.0 if raw else 0.0
    text = str(raw).strip().lower()
    if text in {"true", "yes"}:
        return 1.0
    if text in {"false", "no"}:
        return 0.0
    try:
        return float(text)
    except ValueError:
        return None


def numeric_profile(rows: list[dict[str, Any]]) -> dict[str, float]:
    profile: dict[str, float] = {}
    for feature in NUMERIC_FEATURES:
        values = [number for row in rows if (number := as_number(value(row, feature))) is not None]
        if values:
            profile[feature] = round(median(values), 6)
    return profile


def state_counts(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts: Counter[str] = Counter()
    for row in rows:
        for feature in STATE_FEATURES:
            raw = value(row, feature, default="")
            if raw not in (None, ""):
                counts[f"{feature}={raw}"] += 1
    return [{"state": state, "count": count} for state, count in counts.most_common(25)]


def build_rules(rows: list[dict[str, Any]]) -> dict[str, Any]:
    entries = [row for row in rows if label_type(row) == "ENTRY"]
    skips = [row for row in rows if label_type(row) == "SKIP"]
    exits = [row for row in rows if label_type(row) == "EXIT"]
    entry_profile = numeric_profile(entries)
    skip_profile = numeric_profile(skips)
    entry_states = state_counts(entries)

    suggestions: list[dict[str, Any]] = []
    for feature, entry_value in entry_profile.items():
        skip_value = skip_profile.get(feature)
        if skip_value is None:
            continue
        delta = round(entry_value - skip_value, 6)
        if abs(delta) < 0.000001:
            continue
        suggestions.append(
            {
                "feature": feature,
                "entry_median": entry_value,
                "skip_median": skip_value,
                "direction": ">=" if delta > 0 else "<=",
                "threshold": entry_value,
                "delta": delta,
            }
        )

    return {
        "dataset": {
            "rows": len(rows),
            "entries": len(entries),
            "exits": len(exits),
            "skips": len(skips),
            "gate": {
                "minimum_training_labels": 300,
                "status": "passed" if len(rows) >= 300 else "blocked",
                "remaining": max(300 - len(rows), 0),
            },
        },
        "entry_numeric_medians": entry_profile,
        "skip_numeric_medians": skip_profile,
        "top_entry_states": entry_states,
        "candidate_rules": suggestions[:12],
    }


def write_markdown(path: Path, rules: dict[str, Any]) -> None:
    dataset = rules["dataset"]
    lines = [
        "# Candidate Rules",
        "",
        "This is a scaffolding report generated from training-eligible EdgeLord labels.",
        "",
        "## Dataset",
        "",
        f"- Rows: {dataset['rows']}",
        f"- Entries: {dataset['entries']}",
        f"- Exits: {dataset['exits']}",
        f"- Skips: {dataset['skips']}",
        f"- 300-label gate: {dataset['gate']['status']} ({dataset['gate']['remaining']} remaining)",
        "",
        "## Top Entry States",
        "",
    ]
    if rules["top_entry_states"]:
        lines.extend(f"- {item['count']}: `{item['state']}`" for item in rules["top_entry_states"])
    else:
        lines.append("- No entry states available yet.")

    lines.extend(["", "## Candidate Thresholds", ""])
    if rules["candidate_rules"]:
        for item in rules["candidate_rules"]:
            lines.append(
                f"- `{item['feature']}` {item['direction']} {item['threshold']} "
                f"(entry median {item['entry_median']}, skip median {item['skip_median']})"
            )
    else:
        lines.append("- No threshold candidates yet. Add replay-safe ENTRY and SKIP labels.")

    lines.extend(
        [
            "",
            "## Next Use",
            "",
            "Use this report as a starting point only. The next step is walk-forward testing, not trusting these thresholds.",
            "",
        ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")


def write_model_signals(path: Path, rows: list[dict[str, Any]], rules: dict[str, Any]) -> None:
    rule_items = rules["candidate_rules"][:3]
    fieldnames = ["timestamp", "ticker", "timeframe", "model_action", "matched_rules"]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in sorted(rows, key=sort_key):
            matched: list[str] = []
            for item in rule_items:
                current = as_number(value(row, item["feature"]))
                if current is None:
                    continue
                if item["direction"] == ">=" and current >= item["threshold"]:
                    matched.append(item["feature"])
                if item["direction"] == "<=" and current <= item["threshold"]:
                    matched.append(item["feature"])
            writer.writerow(
                {
                    "timestamp": value(row, "timestamp", default=""),
                    "ticker": value(row, "ticker", default=""),
                    "timeframe": value(row, "timeframe", default=""),
                    "model_action": "ENTRY" if rule_items and len(matched) == len(rule_items) else "SKIP",
                    "matched_rules": "|".join(matched),
                }
            )


def write_pine_stub(path: Path, rules: dict[str, Any]) -> None:
    thresholds = rules["candidate_rules"][:3]
    comments = "\n".join(
        f"// Candidate: {item['feature']} {item['direction']} {item['threshold']}" for item in thresholds
    )
    if not comments:
        comments = "// Add labels, regenerate this packet, then replace these placeholders with tested rules."

    path.write_text(
        f"""//@version=5
strategy("EdgeLord SOXL/SOXS Candidate", overlay=true, initial_capital=10000)

{comments}

ema25 = ta.ema(close, 25)
sma100 = ta.sma(close, 100)
stochK = ta.stoch(close, high, low, 14)
stochD = ta.sma(stochK, 3)

trendOk = close > ema25 and close > sma100
pullbackReset = stochK > stochD and stochK < 35

entrySignal = trendOk and pullbackReset
exitSignal = close < ema25 or stochK > 80

if entrySignal and strategy.position_size == 0
    strategy.entry("LONG", strategy.long)

if exitSignal and strategy.position_size > 0
    strategy.close("LONG")

plot(ema25, "EMA 25", color=color.teal)
plot(sma100, "SMA 100", color=color.orange)
plotshape(entrySignal, title="Candidate Entry", style=shape.triangleup, location=location.belowbar, color=color.lime)
plotshape(exitSignal, title="Candidate Exit", style=shape.triangledown, location=location.abovebar, color=color.red)
""",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a first EdgeLord research packet from training exports.")
    parser.add_argument("dataset", help="Path to Training CSV, labels CSV, JSON, or JSONL export")
    parser.add_argument("--out", default="reports/latest", help="Output directory")
    args = parser.parse_args()

    rows = [row for row in load_rows(args.dataset) if is_training_eligible(row)]
    rules = build_rules(rows)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    (out_dir / "candidate_rules.json").write_text(json.dumps(rules, indent=2) + "\n", encoding="utf-8")
    write_markdown(out_dir / "candidate_rules.md", rules)
    write_model_signals(out_dir / "model_signals.csv", rows, rules)
    write_pine_stub(out_dir / "strategy_soxl_soxs.pine", rules)

    print(f"wrote: {out_dir / 'candidate_rules.json'}")
    print(f"wrote: {out_dir / 'candidate_rules.md'}")
    print(f"wrote: {out_dir / 'model_signals.csv'}")
    print(f"wrote: {out_dir / 'strategy_soxl_soxs.pine'}")


if __name__ == "__main__":
    main()
