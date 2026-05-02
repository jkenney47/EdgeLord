from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


PINE_FEATURE_EXPRESSIONS: dict[str, str] = {
    "feature_close": "close",
    "feature_ema25": "ta.ema(close, 25)",
    "feature_sma100": "ta.sma(close, 100)",
    "feature_atr14": "ta.atr(14)",
    "feature_close_above_ema25": "close > ta.ema(close, 25)",
    "feature_close_above_sma100": "close > ta.sma(close, 100)",
    "feature_distance_to_ema25_pct": "((close - ta.ema(close, 25)) / ta.ema(close, 25)) * 100",
    "feature_distance_to_sma100_pct": "((close - ta.sma(close, 100)) / ta.sma(close, 100)) * 100",
    "feature_recent_5_return_pct": "((close - close[5]) / close[5]) * 100",
    "feature_recent_10_return_pct": "((close - close[10]) / close[10]) * 100",
    "feature_recent_20_return_pct": "((close - close[20]) / close[20]) * 100",
    "feature_recent_20_high": "ta.highest(high, 20)",
    "feature_recent_20_low": "ta.lowest(low, 20)",
    "feature_close_rank_recent_20": "((close - ta.lowest(low, 20)) / math.max(ta.highest(high, 20) - ta.lowest(low, 20), syminfo.mintick))",
}


def read_rules(path: Path) -> dict[str, Any]:
    with path.open() as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError("candidate rules JSON must be an object")
    return payload


def read_optional_object(path: Path | None, label: str) -> dict[str, Any] | None:
    if not path:
        return None
    with path.open() as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError(f"{label} JSON must be an object")
    return payload


def top_candidate(payload: dict[str, Any]) -> dict[str, Any] | None:
    candidates = payload.get("candidates", [])
    if not isinstance(candidates, list) or not candidates:
        return None
    first = candidates[0]
    if not isinstance(first, dict):
        return None
    return first


def pine_feature_support(candidate: dict[str, Any] | None) -> dict[str, Any]:
    if not candidate:
        return {
            "feature": None,
            "supported": False,
            "pineExpression": None,
            "warnings": ["No candidate rule is available yet."],
        }

    feature = str(candidate.get("feature", ""))
    expression = PINE_FEATURE_EXPRESSIONS.get(feature)
    if expression:
        return {
            "feature": feature,
            "supported": True,
            "pineExpression": expression,
            "warnings": [],
        }

    return {
        "feature": feature,
        "supported": False,
        "pineExpression": None,
        "warnings": [
            f"Feature `{feature}` is not mapped to Pine yet.",
            "Review the exported feature definition before implementing this rule in TradingView.",
        ],
    }


def dataset_readiness_payload(dataset_report: dict[str, Any] | None) -> dict[str, Any] | None:
    if not dataset_report:
        return None
    return {
        "sourceVersion": dataset_report.get("version"),
        "counts": dataset_report.get("counts", {}),
        "readiness": dataset_report.get("readiness", {}),
        "issues": dataset_report.get("issues", {}),
    }


def promotion_status(
    human_candidate: dict[str, Any] | None,
    return_candidate: dict[str, Any] | None,
    dataset_report: dict[str, Any] | None,
) -> dict[str, Any]:
    warnings: list[str] = []
    readiness = {}
    if dataset_report:
        readiness_value = dataset_report.get("readiness", {})
        if isinstance(readiness_value, dict):
            readiness = readiness_value

    if dataset_report and not readiness.get("readyForRuleMining"):
        warnings.append("Dataset is not ready for rule mining. Add replay-safe ENTRY and SKIP labels and resolve sequence issues.")
    if dataset_report and not readiness.get("readyForReturnAnalysis"):
        warnings.append("Dataset is not ready for return analysis. Add closed trades with EXIT labels before treating return rules as meaningful.")
    if dataset_report and not readiness.get("readyForRoughRuleMining"):
        warnings.append("Dataset is below rough rule-mining targets. Treat generated rules as plumbing checks, not strategy evidence.")
    if dataset_report and not readiness.get("readyForRoughReturnAnalysis"):
        warnings.append("Dataset is below rough return-analysis targets. Do not promote return-optimized rules yet.")
    if not dataset_report:
        warnings.append("No dataset readiness report was provided.")
    if not human_candidate:
        warnings.append("No human-mimic candidate rule is available yet.")
    if not return_candidate:
        warnings.append("No return-optimized candidate rule is available yet.")

    human_support = pine_feature_support(human_candidate)
    return_support = pine_feature_support(return_candidate)
    if human_candidate and not human_support["supported"]:
        warnings.extend(human_support["warnings"])
    if return_candidate and not return_support["supported"]:
        warnings.extend(return_support["warnings"])

    return {
        "status": "review_ready" if not warnings else "scaffold_only",
        "warnings": warnings,
    }


def strategy_rules_payload(
    human_source: Path,
    human_candidate: dict[str, Any] | None,
    return_source: Path | None,
    return_candidate: dict[str, Any] | None,
    dataset_report: dict[str, Any] | None,
) -> dict[str, Any]:
    warnings = [
        "Research scaffold only. Do not use for live trading.",
        "Human-mimic rules are one-feature ENTRY-vs-SKIP thresholds, not a complete strategy.",
        "Return-optimized rules are closed-label filters, not full-history backtests.",
        "Feature-to-Pine expression mapping must be reviewed before TradingView testing.",
    ]
    return {
        "version": "strategy_rules.v1",
        "generatedAt": datetime.now(UTC).isoformat(),
        "status": "research_scaffold",
        "humanMimicSource": str(human_source),
        "returnOptimizedSource": str(return_source) if return_source else None,
        "humanMimicTopRule": human_candidate,
        "returnOptimizedTopRule": return_candidate,
        "topRule": human_candidate,
        "datasetReadiness": dataset_readiness_payload(dataset_report),
        "pineSupport": {
            "humanMimicTopRule": pine_feature_support(human_candidate),
            "returnOptimizedTopRule": pine_feature_support(return_candidate),
        },
        "promotion": promotion_status(human_candidate, return_candidate, dataset_report),
        "promotionChecklist": [
            "Confirm the rule was generated from replay-safe training rows only.",
            "Confirm the dataset readiness report is clean enough for the intended use.",
            "Confirm the feature is mapped to the same calculation in Pine.",
            "Inspect human-vs-rule disagreements before trusting the signal.",
            "Run walk-forward split evaluation after enough labels exist.",
            "Add explicit exit logic before treating the Pine scaffold as a strategy.",
            "Compare TradingView results against EdgeLord exported trades.",
        ],
        "warnings": warnings,
    }


def pine_expression(feature: str) -> tuple[str, list[str]]:
    comments: list[str] = []
    if feature in PINE_FEATURE_EXPRESSIONS:
        return PINE_FEATURE_EXPRESSIONS[feature], []
    comments.append(f"TODO: map EdgeLord export feature `{feature}` to a Pine expression.")
    return ("na", comments)


def numeric_literal(value: Any) -> str:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return "na"
    return f"{numeric:.10g}"


def comparison_operator(direction: Any) -> str:
    return ">=" if direction == ">=" else "<="


def rule_comment(prefix: str, candidate: dict[str, Any] | None) -> list[str]:
    if not candidate:
        return [f"// {prefix}: no candidate available"]
    feature = str(candidate.get("feature", ""))
    direction = comparison_operator(candidate.get("direction"))
    threshold = numeric_literal(candidate.get("threshold"))
    details: list[str] = []
    if "precision" in candidate:
        details.append(f"precision={float(candidate.get('precision', 0)):.4f}")
    if "recall" in candidate:
        details.append(f"recall={float(candidate.get('recall', 0)):.4f}")
    if "lift" in candidate:
        details.append(f"lift={float(candidate.get('lift', 0)):.4f}")
    if "avg_return_pct" in candidate:
        details.append(f"avg_return={float(candidate.get('avg_return_pct', 0)):.4f}%")
    if "lift_vs_baseline_pct" in candidate:
        details.append(f"lift_vs_baseline={float(candidate.get('lift_vs_baseline_pct', 0)):.4f}%")
    suffix = f" ({', '.join(details)})" if details else ""
    return [f"// {prefix}: {feature} {direction} {threshold}{suffix}"]


def readiness_comments(dataset_report: dict[str, Any] | None) -> list[str]:
    if not dataset_report:
        return ["// Dataset readiness: no dataset report provided"]

    readiness = dataset_report.get("readiness", {})
    counts = dataset_report.get("counts", {})
    if not isinstance(readiness, dict):
        readiness = {}
    if not isinstance(counts, dict):
        counts = {}

    rule_state = "ready" if readiness.get("readyForRuleMining") else "not ready"
    return_state = "ready" if readiness.get("readyForReturnAnalysis") else "not ready"
    rough_rule_state = "ready" if readiness.get("readyForRoughRuleMining") else "not ready"
    rough_return_state = "ready" if readiness.get("readyForRoughReturnAnalysis") else "not ready"
    decision_rows = readiness.get("decisionRows", 0)
    entry_rows = readiness.get("entryRows", 0)
    skip_rows = readiness.get("skipRows", 0)
    closed_trades = readiness.get("closedTrades", 0)
    sequence_issues = counts.get("sequenceIssues", 0)
    targets = readiness.get("targets", {})
    if not isinstance(targets, dict):
        targets = {}
    decision_target = targets.get("roughRuleMiningDecisionRows", 300)
    entry_target = targets.get("roughRuleMiningEntryRows", 100)
    skip_target = targets.get("roughRuleMiningSkipRows", 100)
    closed_target = targets.get("roughReturnAnalysisClosedTrades", 30)
    return [
        f"// Dataset rule-mining readiness: {rule_state} ({entry_rows} entries / {skip_rows} skips / {sequence_issues} sequence issues)",
        f"// Dataset return-analysis readiness: {return_state} ({closed_trades} closed trades)",
        f"// Rough rule-mining target: {rough_rule_state} ({decision_rows}/{decision_target} decisions, {entry_rows}/{entry_target} entries, {skip_rows}/{skip_target} skips)",
        f"// Rough return-analysis target: {rough_return_state} ({closed_trades}/{closed_target} closed trades)",
    ]


def pine_stub(
    human_candidate: dict[str, Any] | None,
    return_candidate: dict[str, Any] | None,
    dataset_report: dict[str, Any] | None,
) -> str:
    lines = [
        "//@version=5",
        'strategy("EdgeLord SOXL/SOXS Candidate Scaffold", overlay=true, pyramiding=0)',
        "",
        "// Generated by EdgeLord research tooling.",
        "// Research scaffold only. Validate the rule, feature mapping, and symbol behavior before TradingView use.",
        "// This is not a live-trading strategy.",
        "",
    ]
    lines.extend(readiness_comments(dataset_report))
    lines.append("")
    lines.extend(rule_comment("Human-mimic candidate", human_candidate))
    lines.extend(rule_comment("Return-optimized candidate", return_candidate))
    lines.append("")

    if not human_candidate:
        lines.extend([
            "// No human-mimic candidate rule is available yet.",
            "// Add replay-safe ENTRY and SKIP labels, then rerun `pnpm research:report`.",
            "candidateSignal = false",
        ])
    else:
        feature = str(human_candidate.get("feature", ""))
        direction = comparison_operator(human_candidate.get("direction"))
        threshold = numeric_literal(human_candidate.get("threshold"))
        expression, comments = pine_expression(feature)
        lines.extend(f"// {comment}" for comment in comments)
        lines.extend([
            f"candidateFeature = {expression}",
            f"candidateSignal = not na(candidateFeature) and candidateFeature {direction} {threshold}",
        ])

    lines.extend([
        "",
        'plotshape(candidateSignal, title="Candidate ENTRY", style=shape.triangleup, location=location.belowbar, size=size.tiny)',
        'if candidateSignal and strategy.position_size == 0',
        '    strategy.entry("Candidate Long", strategy.long)',
        "",
        "// Exits are intentionally not generated yet.",
        "// EdgeLord needs tested exit rules or explicit exported exit logic before this becomes a complete strategy.",
    ])
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate EdgeLord strategy-rules JSON and a Pine Script scaffold.")
    parser.add_argument("--rules-json", required=True, type=Path, help="Path to candidate-rules.json")
    parser.add_argument("--return-rules-json", type=Path, help="Optional path to return-rules.json")
    parser.add_argument("--dataset-report-json", type=Path, help="Optional path to dataset-report.json")
    parser.add_argument("--rules-output", required=True, type=Path, help="Path to write strategy_rules.v1.json")
    parser.add_argument("--pine-output", required=True, type=Path, help="Path to write strategy_soxl_soxs.pine")
    args = parser.parse_args()

    candidate_rules = read_rules(args.rules_json)
    human_candidate = top_candidate(candidate_rules)
    return_candidate = top_candidate(read_rules(args.return_rules_json)) if args.return_rules_json else None
    dataset_report = read_optional_object(args.dataset_report_json, "dataset report")

    args.rules_output.parent.mkdir(parents=True, exist_ok=True)
    args.rules_output.write_text(
        f"{json.dumps(strategy_rules_payload(args.rules_json, human_candidate, args.return_rules_json, return_candidate, dataset_report), indent=2)}\n"
    )

    args.pine_output.parent.mkdir(parents=True, exist_ok=True)
    args.pine_output.write_text(pine_stub(human_candidate, return_candidate, dataset_report))


if __name__ == "__main__":
    main()
