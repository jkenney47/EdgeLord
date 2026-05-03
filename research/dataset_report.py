from __future__ import annotations

import argparse
import csv
import json
import statistics
from collections import Counter
from pathlib import Path
from typing import Iterable


ENTRY_ROUGH_TARGET = 100
DECISION_ROUGH_TARGET = 300
SKIP_ROUGH_TARGET = 100
CLOSED_TRADE_ROUGH_TARGET = 30


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


def training_eligible_closed_trades(labels: list[dict[str, str]], trades: list[dict[str, str]]) -> list[dict[str, str]]:
    labels_by_id = {label.get("id", ""): label for label in labels if label.get("id", "")}
    return [
        trade for trade in trades
        if trade.get("status") == "closed" and
        labels_by_id.get(trade.get("entry_label_id", ""), {}).get("training_eligible") == "1" and
        labels_by_id.get(trade.get("exit_label_id", ""), {}).get("training_eligible") == "1"
    ]


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


def training_coverage(training: list[dict[str, str]]) -> dict[str, object]:
    by_year: Counter[str] = Counter()
    by_ticker_timeframe: Counter[str] = Counter()
    by_year_ticker: Counter[str] = Counter()
    by_year_timeframe: Counter[str] = Counter()
    by_year_action: Counter[str] = Counter()

    for row in training:
        timestamp = row.get("timestamp", "")
        year = timestamp[:4] if len(timestamp) >= 4 else "(blank)"
        ticker = row.get("ticker", "") or "(blank)"
        timeframe = row.get("timeframe", "") or "(blank)"
        action = row.get("action", "") or "(blank)"
        by_year[year] += 1
        by_ticker_timeframe[f"{ticker}:{timeframe}"] += 1
        by_year_ticker[f"{year}:{ticker}"] += 1
        by_year_timeframe[f"{year}:{timeframe}"] += 1
        by_year_action[f"{year}:{action}"] += 1

    years = sorted(by_year)
    return {
        "years": {year: by_year[year] for year in years},
        "tickerTimeframes": dict(sorted(by_ticker_timeframe.items())),
        "yearTickers": dict(sorted(by_year_ticker.items())),
        "yearTimeframes": dict(sorted(by_year_timeframe.items())),
        "yearActions": dict(sorted(by_year_action.items())),
        "weakestYears": [
            {"year": year, "rows": by_year[year]}
            for year in sorted(years, key=lambda item: (by_year[item], item))[:10]
        ],
        "weakestTickerTimeframes": [
            {"tickerTimeframe": key, "rows": by_ticker_timeframe[key]}
            for key in sorted(by_ticker_timeframe, key=lambda item: (by_ticker_timeframe[item], item))[:10]
        ],
    }


def format_training_coverage(coverage: dict[str, object]) -> list[str]:
    lines = ["\nTraining Coverage Matrix"]
    years = coverage.get("years", {})
    if not isinstance(years, dict) or not years:
        return [*lines, "  none"]

    lines.append("  rows_by_year:")
    for year, count in years.items():
        lines.append(f"    {year}: {count}")

    ticker_timeframes = coverage.get("tickerTimeframes", {})
    if isinstance(ticker_timeframes, dict) and ticker_timeframes:
        lines.append("  rows_by_ticker_timeframe:")
        for key, count in ticker_timeframes.items():
            lines.append(f"    {key}: {count}")

    weakest_years = coverage.get("weakestYears", [])
    if isinstance(weakest_years, list) and weakest_years:
        formatted = ", ".join(
            f"{item.get('year')}={item.get('rows')}"
            for item in weakest_years
            if isinstance(item, dict)
        )
        if formatted:
            lines.append(f"  weakest_years: {formatted}")

    weakest_ticker_timeframes = coverage.get("weakestTickerTimeframes", [])
    if isinstance(weakest_ticker_timeframes, list) and weakest_ticker_timeframes:
        formatted = ", ".join(
            f"{item.get('tickerTimeframe')}={item.get('rows')}"
            for item in weakest_ticker_timeframes
            if isinstance(item, dict)
        )
        if formatted:
            lines.append(f"  weakest_ticker_timeframes: {formatted}")

    return lines


def sequence_issues(labels: list[dict[str, str]]) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    open_label: dict[str, str] | None = None
    for label in sorted(labels, key=lambda row: row.get("created_at") or row.get("timestamp") or ""):
        action = label.get("action", "")
        is_excluded_orphan_exit = (
            action == "EXIT" and
            label.get("training_eligible") != "1" and
            not label.get("trade_id") and
            not label.get("parent_entry_label_id")
        )
        if is_excluded_orphan_exit:
            continue
        if action == "ENTRY":
            if open_label:
                issues.append({
                    "label_id": label.get("id", ""),
                    "action": action,
                    "ticker": label.get("ticker", ""),
                    "timestamp": label.get("timestamp", ""),
                    "reason": f"ENTRY while {open_label.get('ticker', '')} trade {open_label.get('id', '')} is still open",
                    "open_label_id": open_label.get("id", ""),
                })
            else:
                open_label = label
        elif action == "SKIP" and open_label and label.get("training_eligible") == "1":
            issues.append({
                "label_id": label.get("id", ""),
                "action": action,
                "ticker": label.get("ticker", ""),
                "timestamp": label.get("timestamp", ""),
                "reason": f"SKIP while {open_label.get('ticker', '')} trade {open_label.get('id', '')} is still open",
                "open_label_id": open_label.get("id", ""),
            })
        elif action == "EXIT":
            if not open_label:
                issues.append({
                    "label_id": label.get("id", ""),
                    "action": action,
                    "ticker": label.get("ticker", ""),
                    "timestamp": label.get("timestamp", ""),
                    "reason": "EXIT with no open trade",
                    "open_label_id": "",
                })
            elif open_label.get("ticker") != label.get("ticker"):
                issues.append({
                    "label_id": label.get("id", ""),
                    "action": action,
                    "ticker": label.get("ticker", ""),
                    "timestamp": label.get("timestamp", ""),
                    "reason": f"EXIT {label.get('ticker', '')} while open trade is {open_label.get('ticker', '')}",
                    "open_label_id": open_label.get("id", ""),
                })
            elif label.get("timestamp", "") < open_label.get("timestamp", ""):
                issues.append({
                    "label_id": label.get("id", ""),
                    "action": action,
                    "ticker": label.get("ticker", ""),
                    "timestamp": label.get("timestamp", ""),
                    "reason": f"EXIT before entry label {open_label.get('id', '')}",
                    "open_label_id": open_label.get("id", ""),
                })
            else:
                open_label = None
    return issues


def format_sequence_issues(issues: list[dict[str, str]]) -> list[str]:
    lines = ["\nState Machine Sequence Issues"]
    if not issues:
        return [*lines, "  none"]
    for issue in issues[:25]:
        lines.append(
            f"  {issue['label_id']} {issue['action']} {issue['ticker']} {issue['timestamp']}: {issue['reason']}"
        )
    return lines


def same_candle_decision_conflicts(labels: list[dict[str, str]]) -> list[dict[str, object]]:
    grouped: dict[str, list[dict[str, str]]] = {}
    for label in labels:
        key = "|".join([
            label.get("label_source", ""),
            label.get("ticker", ""),
            label.get("timeframe", ""),
            label.get("timestamp", ""),
        ])
        grouped.setdefault(key, []).append(label)

    conflicts: list[dict[str, object]] = []
    for group in grouped.values():
        if len(group) <= 1:
            continue
        first = group[0]
        conflicts.append({
            "labelSource": first.get("label_source", ""),
            "ticker": first.get("ticker", ""),
            "timeframe": first.get("timeframe", ""),
            "timestamp": first.get("timestamp", ""),
            "actions": sorted({label.get("action", "") for label in group}),
            "labelIds": [label.get("id", "") for label in group],
        })
    return conflicts


def format_same_candle_decision_conflicts(conflicts: list[dict[str, object]]) -> list[str]:
    lines = ["\nSame-Candle Decision Conflicts"]
    if not conflicts:
        return [*lines, "  none"]
    for conflict in conflicts[:25]:
        actions = conflict.get("actions", [])
        label_ids = conflict.get("labelIds", [])
        lines.append(
            f"  {conflict['labelSource']} {conflict['ticker']} {conflict['timeframe']} {conflict['timestamp']}: "
            f"actions={'|'.join(actions) if isinstance(actions, list) else actions} "
            f"ids={'|'.join(label_ids) if isinstance(label_ids, list) else label_ids}"
        )
    return lines


def counter_dict(rows: Iterable[dict[str, str]], key: str) -> dict[str, int]:
    return dict(count_by(rows, key).most_common())


def return_summary(trades: list[dict[str, str]]) -> dict[str, float | int | None]:
    returns = numeric_values((trade for trade in trades if trade.get("status") == "closed"), "return_pct")
    if not returns:
        return {
            "count": 0,
            "winRate": None,
            "avgReturnPct": None,
            "medianReturnPct": None,
            "minReturnPct": None,
            "maxReturnPct": None,
        }
    wins = sum(1 for value in returns if value > 0)
    return {
        "count": len(returns),
        "winRate": wins / len(returns),
        "avgReturnPct": statistics.fmean(returns),
        "medianReturnPct": statistics.median(returns),
        "minReturnPct": min(returns),
        "maxReturnPct": max(returns),
    }


def labeling_target_plan(
    labels: list[dict[str, str]],
    training: list[dict[str, str]],
    trades: list[dict[str, str]],
    orphan_exits: list[dict[str, str]],
    entries_without_trade: list[dict[str, str]],
    state_sequence_issues: list[dict[str, str]],
    decision_conflicts: list[dict[str, object]],
    training_issues: dict[str, list[str]],
    target_issues: list[dict[str, str]],
    trade_candidate_status: dict[str, object],
) -> list[dict[str, object]]:
    training_actions = count_by(training, "action")
    entries = training_actions.get("ENTRY", 0)
    exits = training_actions.get("EXIT", 0)
    skips = training_actions.get("SKIP", 0)
    decisions = len(training)
    closed = len(training_eligible_closed_trades(labels, trades))
    excluded = len([label for label in labels if label.get("training_eligible") != "1"])
    consistency_issue_count = (
        len(orphan_exits) +
        len(entries_without_trade) +
        len(state_sequence_issues) +
        len(decision_conflicts) +
        len(training_issues["missingEligibleLabelIds"]) +
        len(training_issues["extraTrainingLabelIds"]) +
        len(training_issues["duplicateTrainingLabelIds"]) +
        len(target_issues)
    )
    if trade_candidate_has_issues(trade_candidate_status):
        consistency_issue_count += (
            len(trade_candidate_status["missingClosedTradeCandidateIds"]) +
            len(trade_candidate_status["extraCandidateTradeIds"]) +
            len(trade_candidate_status["duplicateCandidateIds"])
        )

    plan: list[dict[str, object]] = []
    priority = 1

    if consistency_issue_count > 0:
        plan.append({
            "priority": priority,
            "kind": "fix_integrity",
            "status": "blocked",
            "current": consistency_issue_count,
            "target": 0,
            "remaining": consistency_issue_count,
            "action": "Fix dataset consistency, state-machine, target-encoding, or trade-candidate issues before adding modeling labels.",
        })
        priority += 1

    target_rows = [
        ("exit_coverage", exits, max(entries, 1), "Add EXIT labels for open/unfinished entries so trades can be paired and evaluated."),
        ("skip_coverage", skips, max(entries, SKIP_ROUGH_TARGET), "Add replay-safe SKIP labels near tempting setups to create negative examples."),
        ("entry_coverage", entries, ENTRY_ROUGH_TARGET, "Add replay-safe ENTRY labels across SOXL and SOXS setups."),
        ("decision_coverage", decisions, DECISION_ROUGH_TARGET, "Add more replay-safe decision rows until rough rule mining has enough examples."),
        ("closed_trade_coverage", closed, CLOSED_TRADE_ROUGH_TARGET, "Close labeled trades with explicit EXIT labels so return analysis and exit rules can run."),
    ]

    for kind, current, target, action in target_rows:
        remaining = max(0, target - current)
        plan.append({
            "priority": priority,
            "kind": kind,
            "status": "ready" if remaining > 0 and consistency_issue_count == 0 else "complete" if remaining == 0 else "blocked",
            "current": current,
            "target": target,
            "remaining": remaining,
            "action": action,
        })
        priority += 1

    if excluded > 0:
        plan.append({
            "priority": priority,
            "kind": "excluded_label_review",
            "status": "review",
            "current": excluded,
            "target": 0,
            "remaining": excluded,
            "action": "Review excluded labels before intentionally including regular or hindsight rows in research.",
        })

    return plan


def format_labeling_target_plan(plan: list[dict[str, object]]) -> list[str]:
    lines = ["\nLabeling Target Plan"]
    if not plan:
        return [*lines, "  none"]
    for item in plan:
        lines.append(
            f"  {item['priority']}. {item['kind']}: {item['current']}/{item['target']} "
            f"(remaining {item['remaining']}, {item['status']})"
        )
        lines.append(f"     {item['action']}")
    return lines


def feature_coverage_summary(training: list[dict[str, str]]) -> dict[str, object]:
    feature_columns = [column for column in training[0].keys() if column.startswith("feature_")] if training else []
    missing = {column: missing_count(training, column) for column in feature_columns}
    return {
        "featureColumns": len(feature_columns),
        "fullyPopulated": sum(1 for count in missing.values() if count == 0),
        "missing": missing,
    }


def training_row_issues(labels: list[dict[str, str]], training: list[dict[str, str]]) -> dict[str, list[str]]:
    eligible_label_ids = {label.get("id", "") for label in labels if label.get("training_eligible") == "1" and label.get("id", "")}
    training_ids = [row.get("label_id", "") for row in training if row.get("label_id", "")]
    training_id_counts = Counter(training_ids)
    training_id_set = set(training_ids)
    return {
        "missingEligibleLabelIds": sorted(eligible_label_ids - training_id_set),
        "extraTrainingLabelIds": sorted(training_id_set - eligible_label_ids),
        "duplicateTrainingLabelIds": sorted(label_id for label_id, count in training_id_counts.items() if count > 1),
    }


def target_encoding_issues(training: list[dict[str, str]]) -> list[dict[str, str]]:
    target_columns = {
        "ENTRY": "target_entry",
        "EXIT": "target_exit",
        "SKIP": "target_skip",
        "INVALID": "target_invalid",
    }
    issues: list[dict[str, str]] = []
    for row in training:
        action = row.get("action", "")
        if action not in target_columns:
            issues.append({
                "label_id": row.get("label_id", ""),
                "action": action,
                "reason": "unknown action",
            })
            continue

        expected = {
            column: "1" if column == target_columns[action] else "0"
            for column in target_columns.values()
        }
        mismatched = [
            column for column, expected_value in expected.items()
            if row.get(column, "") != expected_value
        ]
        if mismatched:
            issues.append({
                "label_id": row.get("label_id", ""),
                "action": action,
                "reason": f"target columns do not match action: {', '.join(mismatched)}",
            })
    return issues


def format_target_encoding_issues(issues: list[dict[str, str]]) -> list[str]:
    lines = ["\nTarget Encoding Consistency"]
    if not issues:
        return [*lines, "  actions match target columns"]
    for issue in issues[:25]:
        lines.append(f"  {issue['label_id']} {issue['action']}: {issue['reason']}")
    return lines


def has_training_row_issues(issues: dict[str, list[str]]) -> bool:
    return any(issues.values())


def format_training_row_issues(issues: dict[str, list[str]]) -> list[str]:
    lines = ["\nTraining Row Consistency"]
    if not has_training_row_issues(issues):
        return [*lines, "  eligible labels match training rows"]
    if issues["missingEligibleLabelIds"]:
        lines.append("  missing_eligible_label_ids:")
        for label_id in issues["missingEligibleLabelIds"][:25]:
            lines.append(f"    {label_id}")
    if issues["extraTrainingLabelIds"]:
        lines.append("  extra_training_label_ids:")
        for label_id in issues["extraTrainingLabelIds"][:25]:
            lines.append(f"    {label_id}")
    if issues["duplicateTrainingLabelIds"]:
        lines.append("  duplicate_training_label_ids:")
        for label_id in issues["duplicateTrainingLabelIds"][:25]:
            lines.append(f"    {label_id}")
    return lines


def trade_candidate_summary(labels: list[dict[str, str]], trades: list[dict[str, str]], candidates: list[dict[str, str]]) -> dict[str, object]:
    labels_by_id = {label.get("id", ""): label for label in labels if label.get("id", "")}
    closed_trade_ids = {
        trade.get("trade_id", "")
        for trade in trades
        if trade.get("status") == "closed" and
        trade.get("trade_id", "") and
        labels_by_id.get(trade.get("entry_label_id", ""), {}).get("training_eligible") == "1" and
        labels_by_id.get(trade.get("exit_label_id", ""), {}).get("training_eligible") == "1"
    }
    candidate_ids = [row.get("candidate_id", "") for row in candidates if row.get("candidate_id", "")]
    candidate_id_counts = Counter(candidate_ids)
    candidate_trade_ids = {row.get("trade_id", "") for row in candidates if row.get("trade_id", "")}
    actions = counter_dict(candidates, "action")
    return {
        "rows": len(candidates),
        "actions": actions,
        "exitRows": actions.get("EXIT", 0),
        "holdRows": actions.get("HOLD", 0),
        "closedTrades": len(closed_trade_ids),
        "closedTradesWithCandidates": len(closed_trade_ids & candidate_trade_ids),
        "missingClosedTradeCandidateIds": sorted(closed_trade_ids - candidate_trade_ids),
        "extraCandidateTradeIds": sorted(candidate_trade_ids - closed_trade_ids),
        "duplicateCandidateIds": sorted(candidate_id for candidate_id, count in candidate_id_counts.items() if count > 1),
    }


def trade_candidate_has_issues(summary: dict[str, object]) -> bool:
    return bool(
        summary["missingClosedTradeCandidateIds"] or
        summary["extraCandidateTradeIds"] or
        summary["duplicateCandidateIds"]
    )


def format_trade_candidate_summary(summary: dict[str, object]) -> list[str]:
    lines = ["\nTrade Candidate Coverage"]
    actions = summary["actions"]
    if not isinstance(actions, dict):
        actions = {}
    lines.append(f"  rows: {summary['rows']}")
    lines.append(f"  closed_trades_with_candidates: {summary['closedTradesWithCandidates']}/{summary['closedTrades']}")
    if actions:
        lines.append("  actions:")
        for action, count in actions.items():
            lines.append(f"    {action}: {count}")
    else:
        lines.append("  actions: none")

    if not trade_candidate_has_issues(summary):
        lines.append("  candidate trade links are consistent")
        return lines

    for key, label in [
        ("missingClosedTradeCandidateIds", "missing_closed_trade_candidate_ids"),
        ("extraCandidateTradeIds", "extra_candidate_trade_ids"),
        ("duplicateCandidateIds", "duplicate_candidate_ids"),
    ]:
        values = summary[key]
        if isinstance(values, list) and values:
            lines.append(f"  {label}:")
            for value in values[:25]:
                lines.append(f"    {value}")
    return lines


def dataset_summary(
    labels: list[dict[str, str]],
    training: list[dict[str, str]],
    trades: list[dict[str, str]],
    orphan_exits: list[dict[str, str]],
    entries_without_trade: list[dict[str, str]],
    state_sequence_issues: list[dict[str, str]],
    decision_conflicts: list[dict[str, object]],
    training_issues: dict[str, list[str]],
    target_issues: list[dict[str, str]],
    trade_candidate_status: dict[str, object],
) -> dict[str, object]:
    training_actions = count_by(training, "action")
    entry_count = training_actions.get("ENTRY", 0)
    skip_count = training_actions.get("SKIP", 0)
    exit_count = training_actions.get("EXIT", 0)
    decision_count = len(training)
    closed_trade_count = len(training_eligible_closed_trades(labels, trades))
    excluded_labels = [label for label in labels if label.get("training_eligible") != "1"]
    ready_for_rule_mining = (
        len(orphan_exits) == 0 and
        len(entries_without_trade) == 0 and
        len(state_sequence_issues) == 0 and
        len(decision_conflicts) == 0 and
        not has_training_row_issues(training_issues) and
        len(target_issues) == 0 and
        entry_count > 0 and
        skip_count > 0
    )
    ready_for_return_analysis = (
        ready_for_rule_mining and
        closed_trade_count > 0 and
        exit_count > 0
    )
    ready_for_exit_rule_mining = (
        ready_for_return_analysis and
        trade_candidate_status["exitRows"] > 0 and
        trade_candidate_status["holdRows"] > 0 and
        not trade_candidate_has_issues(trade_candidate_status)
    )
    ready_for_rough_rule_mining = (
        ready_for_rule_mining and
        entry_count >= ENTRY_ROUGH_TARGET and
        skip_count >= SKIP_ROUGH_TARGET and
        decision_count >= DECISION_ROUGH_TARGET
    )
    ready_for_rough_return_analysis = (
        ready_for_rough_rule_mining and
        closed_trade_count >= CLOSED_TRADE_ROUGH_TARGET and
        exit_count >= ENTRY_ROUGH_TARGET
    )
    labeling_plan = labeling_target_plan(
        labels,
        training,
        trades,
        orphan_exits,
        entries_without_trade,
        state_sequence_issues,
        decision_conflicts,
        training_issues,
        target_issues,
        trade_candidate_status,
    )
    coverage = training_coverage(training)
    return {
        "version": "edgelord.dataset_report.v1",
        "counts": {
            "labels": len(labels),
            "trainingRows": len(training),
            "trainingEligibleLabels": len([label for label in labels if label.get("training_eligible") == "1"]),
            "excludedLabels": len(excluded_labels),
            "trades": len(trades),
            "orphanExits": len(orphan_exits),
            "entriesWithoutTrade": len(entries_without_trade),
            "sequenceIssues": len(state_sequence_issues),
            "sameCandleDecisionConflicts": len(decision_conflicts),
            "missingEligibleTrainingRows": len(training_issues["missingEligibleLabelIds"]),
            "extraTrainingRows": len(training_issues["extraTrainingLabelIds"]),
            "duplicateTrainingRows": len(training_issues["duplicateTrainingLabelIds"]),
            "targetEncodingIssues": len(target_issues),
            "tradeCandidateRows": trade_candidate_status["rows"],
            "tradeCandidateExitRows": trade_candidate_status["exitRows"],
            "tradeCandidateHoldRows": trade_candidate_status["holdRows"],
            "closedTradesWithCandidates": trade_candidate_status["closedTradesWithCandidates"],
            "missingClosedTradeCandidates": len(trade_candidate_status["missingClosedTradeCandidateIds"]),
            "extraTradeCandidateRows": len(trade_candidate_status["extraCandidateTradeIds"]),
            "duplicateTradeCandidateRows": len(trade_candidate_status["duplicateCandidateIds"]),
        },
        "actions": counter_dict(labels, "action"),
        "trainingActions": counter_dict(training, "action"),
        "labelSources": counter_dict(labels, "label_source"),
        "trainingLabelSources": counter_dict(training, "label_source"),
        "trainingCaptureModes": counter_dict(training, "capture_mode"),
        "tickers": counter_dict(labels, "ticker"),
        "timeframes": counter_dict(labels, "timeframe"),
        "tradeStatus": counter_dict(trades, "status"),
        "returns": return_summary(training_eligible_closed_trades(labels, trades)),
        "featureCoverage": feature_coverage_summary(training),
        "trainingCoverage": coverage,
        "labelingPlan": labeling_plan,
        "issues": {
            "orphanExits": [
                {"id": label.get("id", ""), "ticker": label.get("ticker", ""), "timestamp": label.get("timestamp", "")}
                for label in orphan_exits[:25]
            ],
            "entriesWithoutTrade": [
                {"id": label.get("id", ""), "ticker": label.get("ticker", ""), "timestamp": label.get("timestamp", "")}
                for label in entries_without_trade[:25]
            ],
            "sequenceIssues": state_sequence_issues[:25],
            "sameCandleDecisionConflicts": decision_conflicts[:25],
            "trainingRows": training_issues,
            "targetEncoding": target_issues[:25],
            "tradeCandidates": {
                "missingClosedTradeCandidateIds": trade_candidate_status["missingClosedTradeCandidateIds"],
                "extraCandidateTradeIds": trade_candidate_status["extraCandidateTradeIds"],
                "duplicateCandidateIds": trade_candidate_status["duplicateCandidateIds"],
            },
        },
        "readiness": {
            "readyForRuleMining": ready_for_rule_mining,
            "readyForReturnAnalysis": ready_for_return_analysis,
            "readyForRoughRuleMining": ready_for_rough_rule_mining,
            "readyForRoughReturnAnalysis": ready_for_rough_return_analysis,
            "readyForExitRuleMining": ready_for_exit_rule_mining,
            "decisionRows": decision_count,
            "entryRows": entry_count,
            "skipRows": skip_count,
            "exitRows": exit_count,
            "closedTrades": closed_trade_count,
            "tradeCandidateRows": trade_candidate_status["rows"],
            "tradeCandidateExitRows": trade_candidate_status["exitRows"],
            "tradeCandidateHoldRows": trade_candidate_status["holdRows"],
            "targets": {
                "roughRuleMiningDecisionRows": DECISION_ROUGH_TARGET,
                "roughRuleMiningEntryRows": ENTRY_ROUGH_TARGET,
                "roughRuleMiningSkipRows": SKIP_ROUGH_TARGET,
                "roughReturnAnalysisClosedTrades": CLOSED_TRADE_ROUGH_TARGET,
            },
        },
    }


def next_label_recommendations(
    labels: list[dict[str, str]],
    training: list[dict[str, str]],
    trades: list[dict[str, str]],
    orphan_exits: list[dict[str, str]],
    entries_without_trade: list[dict[str, str]],
    state_sequence_issues: list[dict[str, str]],
    decision_conflicts: list[dict[str, object]],
    training_issues: dict[str, list[str]],
    target_issues: list[dict[str, str]],
    trade_candidate_status: dict[str, object],
) -> list[str]:
    training_actions = count_by(training, "action")
    training_tickers = count_by(training, "ticker")
    training_timeframes = count_by(training, "timeframe")
    entries = training_actions.get("ENTRY", 0)
    exits = training_actions.get("EXIT", 0)
    skips = training_actions.get("SKIP", 0)
    closed = len(training_eligible_closed_trades(labels, trades))
    excluded = len([label for label in labels if label.get("training_eligible") != "1"])

    lines = ["\nWhat To Label Next"]
    if (
        orphan_exits or entries_without_trade or state_sequence_issues or decision_conflicts or
        has_training_row_issues(training_issues) or target_issues or
        trade_candidate_has_issues(trade_candidate_status)
    ):
        lines.append("  1. Fix dataset consistency, state-machine, or orphan trade-link issues before adding modeling labels.")
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
        lines.append(f"  3. Complete more closed trades for return analysis: {closed} eligible closed trades.")
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
    parser.add_argument("--trade-candidates", type=Path, help="Optional path to trade-candidates.csv export")
    parser.add_argument("--output", type=Path, help="Optional path to write the report as markdown/plain text")
    parser.add_argument("--json-output", type=Path, help="Optional path to write a machine-readable report summary")
    args = parser.parse_args()

    labels = read_csv(args.labels)
    training = read_csv(args.training)
    trades = read_csv(args.trades)
    trade_candidates = read_csv(args.trade_candidates) if args.trade_candidates else []

    eligible_labels = [label for label in labels if label.get("training_eligible") == "1"]
    excluded_labels = [label for label in labels if label.get("training_eligible") != "1"]
    orphan_exits = [
        label for label in labels
        if label.get("action") == "EXIT" and
        label.get("training_eligible") == "1" and
        (not label.get("trade_id") or not label.get("parent_entry_label_id"))
    ]
    entries_without_trade = [
        label for label in labels
        if label.get("action") == "ENTRY" and not label.get("trade_id")
    ]
    state_sequence_issues = sequence_issues(labels)
    decision_conflicts = same_candle_decision_conflicts(labels)
    training_issues = training_row_issues(labels, training)
    target_issues = target_encoding_issues(training)
    trade_candidate_status = trade_candidate_summary(labels, trades, trade_candidates)

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
        f"sequence_issues: {len(state_sequence_issues)}",
        f"same_candle_decision_conflicts: {len(decision_conflicts)}",
        f"missing_eligible_training_rows: {len(training_issues['missingEligibleLabelIds'])}",
        f"extra_training_rows: {len(training_issues['extraTrainingLabelIds'])}",
        f"duplicate_training_rows: {len(training_issues['duplicateTrainingLabelIds'])}",
        f"target_encoding_issues: {len(target_issues)}",
        f"trade_candidate_rows: {trade_candidate_status['rows']}",
        f"missing_closed_trade_candidates: {len(trade_candidate_status['missingClosedTradeCandidateIds'])}",
    ]

    lines.extend(format_counts("Actions", count_by(labels, "action")))
    lines.extend(format_counts("Training Actions", count_by(training, "action")))
    lines.extend(format_counts("Label Sources", count_by(labels, "label_source")))
    lines.extend(format_counts("Training Label Sources", count_by(training, "label_source")))
    lines.extend(format_counts("Training Capture Modes", count_by(training, "capture_mode")))
    lines.extend(format_counts("Tickers", count_by(labels, "ticker")))
    lines.extend(format_counts("Timeframes", count_by(labels, "timeframe")))
    lines.extend(format_counts("Trade Status", count_by(trades, "status")))
    lines.extend(format_return_summary(training_eligible_closed_trades(labels, trades)))
    lines.extend(format_sequence_issues(state_sequence_issues))
    lines.extend(format_same_candle_decision_conflicts(decision_conflicts))
    lines.extend(format_training_row_issues(training_issues))
    lines.extend(format_target_encoding_issues(target_issues))
    lines.extend(format_trade_candidate_summary(trade_candidate_status))
    lines.extend(format_training_coverage(training_coverage(training)))
    lines.extend(format_feature_coverage(training))
    lines.extend(format_feature_contrasts(training))
    lines.extend(format_labeling_target_plan(labeling_target_plan(
        labels,
        training,
        trades,
        orphan_exits,
        entries_without_trade,
        state_sequence_issues,
        decision_conflicts,
        training_issues,
        target_issues,
        trade_candidate_status,
    )))

    lines.append("\nReadiness")
    entry_count = count_by(training, "action").get("ENTRY", 0)
    skip_count = count_by(training, "action").get("SKIP", 0)
    exit_count = count_by(training, "action").get("EXIT", 0)
    closed_count = len(training_eligible_closed_trades(labels, trades))
    if len(training) < DECISION_ROUGH_TARGET:
        lines.append(f"  decision rows are still early: {len(training)}/{DECISION_ROUGH_TARGET} rough-mining target")
    else:
        lines.append(f"  decision rows reached rough-mining target: {len(training)}")
    if entry_count < ENTRY_ROUGH_TARGET:
        lines.append(f"  entry labels are still early: {entry_count}/{ENTRY_ROUGH_TARGET} rough-mining target")
    else:
        lines.append(f"  entry labels reached rough-mining target: {entry_count}")
    if skip_count < SKIP_ROUGH_TARGET:
        lines.append(f"  skip labels are still early: {skip_count}/{SKIP_ROUGH_TARGET} rough-mining target")
    elif skip_count < entry_count:
        lines.append(f"  add more SKIP examples near tempting setups: {skip_count} skips vs {entry_count} entries")
    else:
        lines.append(f"  skip coverage is at least entry-sized: {skip_count} skips vs {entry_count} entries")
    if exit_count < entry_count:
        lines.append(f"  exits are behind entries: {exit_count} exits vs {entry_count} entries")
    if closed_count < CLOSED_TRADE_ROUGH_TARGET:
        lines.append(f"  eligible closed trades are still early: {closed_count}/{CLOSED_TRADE_ROUGH_TARGET} return-analysis target")
    if (
        orphan_exits or entries_without_trade or state_sequence_issues or decision_conflicts or
        has_training_row_issues(training_issues) or target_issues or
        trade_candidate_has_issues(trade_candidate_status)
    ):
        lines.append("  fix dataset consistency/state-machine/orphan trade-link issues before modeling")
    if excluded_labels:
        lines.append("  excluded labels are present; keep them out of training unless intentionally studying hindsight")

    lines.extend(next_label_recommendations(
        labels,
        training,
        trades,
        orphan_exits,
        entries_without_trade,
        state_sequence_issues,
        decision_conflicts,
        training_issues,
        target_issues,
        trade_candidate_status,
    ))

    report = "\n".join(lines) + "\n"
    print(report, end="")
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report)
    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        summary = dataset_summary(
            labels,
            training,
            trades,
            orphan_exits,
            entries_without_trade,
            state_sequence_issues,
            decision_conflicts,
            training_issues,
            target_issues,
            trade_candidate_status,
        )
        args.json_output.write_text(f"{json.dumps(summary, indent=2)}\n")


if __name__ == "__main__":
    main()
