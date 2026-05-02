from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def read_pine_feature_expressions() -> dict[str, str]:
    path = Path(__file__).with_name("pine_feature_map.json")
    with path.open() as handle:
        payload = json.load(handle)
    expressions = payload.get("expressions", {})
    if not isinstance(expressions, dict):
        raise ValueError("pine_feature_map.json must contain an expressions object")
    return {str(key): str(value) for key, value in expressions.items()}


PINE_FEATURE_EXPRESSIONS = read_pine_feature_expressions()


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


def top_pair_candidate(payload: dict[str, Any]) -> dict[str, Any] | None:
    candidates = payload.get("pairCandidates", [])
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


def pine_pair_support(candidate: dict[str, Any] | None) -> dict[str, Any]:
    if not candidate:
        return {
            "supported": False,
            "conditions": [],
            "warnings": ["No pair candidate rule is available yet."],
        }

    conditions = candidate.get("conditions", [])
    if not isinstance(conditions, list) or not conditions:
        return {
            "supported": False,
            "conditions": [],
            "warnings": ["Pair candidate has no conditions."],
        }

    mapped_conditions: list[dict[str, Any]] = []
    warnings: list[str] = []
    for condition in conditions:
        if not isinstance(condition, dict):
            warnings.append("Pair candidate contains a non-object condition.")
            continue
        feature = str(condition.get("feature", ""))
        expression = PINE_FEATURE_EXPRESSIONS.get(feature)
        if not expression:
            warnings.append(f"Feature `{feature}` is not mapped to Pine yet.")
        mapped_conditions.append({
            "feature": feature,
            "direction": comparison_operator(condition.get("direction")),
            "threshold": condition.get("threshold"),
            "pineExpression": expression,
            "supported": expression is not None,
        })

    return {
        "supported": bool(mapped_conditions) and not warnings,
        "conditions": mapped_conditions,
        "warnings": warnings,
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
    human_pair_candidate: dict[str, Any] | None,
    return_candidate: dict[str, Any] | None,
    exit_candidate: dict[str, Any] | None,
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
    if not exit_candidate:
        warnings.append("No rough exit candidate rule is available yet.")

    human_support = pine_feature_support(human_candidate)
    human_pair_support = pine_pair_support(human_pair_candidate)
    return_support = pine_feature_support(return_candidate)
    exit_support = pine_feature_support(exit_candidate)
    if human_candidate and not human_support["supported"]:
        warnings.extend(human_support["warnings"])
    if human_pair_candidate and not human_pair_support["supported"]:
        warnings.extend(human_pair_support["warnings"])
    if return_candidate and not return_support["supported"]:
        warnings.extend(return_support["warnings"])
    if exit_candidate and not exit_support["supported"]:
        warnings.extend(exit_support["warnings"])

    return {
        "status": "review_ready" if not warnings else "scaffold_only",
        "warnings": warnings,
    }


def strategy_rules_payload(
    human_source: Path,
    human_candidate: dict[str, Any] | None,
    human_pair_candidate: dict[str, Any] | None,
    return_source: Path | None,
    return_candidate: dict[str, Any] | None,
    exit_source: Path | None,
    exit_candidate: dict[str, Any] | None,
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
        "exitRuleSource": str(exit_source) if exit_source else None,
        "humanMimicTopRule": human_candidate,
        "humanMimicTopPairRule": human_pair_candidate,
        "returnOptimizedTopRule": return_candidate,
        "exitTopRule": exit_candidate,
        "topRule": human_pair_candidate if pine_pair_support(human_pair_candidate)["supported"] else human_candidate,
        "datasetReadiness": dataset_readiness_payload(dataset_report),
        "pineSupport": {
            "humanMimicTopRule": pine_feature_support(human_candidate),
            "humanMimicTopPairRule": pine_pair_support(human_pair_candidate),
            "returnOptimizedTopRule": pine_feature_support(return_candidate),
            "exitTopRule": pine_feature_support(exit_candidate),
        },
        "promotion": promotion_status(human_candidate, human_pair_candidate, return_candidate, exit_candidate, dataset_report),
        "promotionChecklist": [
            "Confirm the rule was generated from replay-safe training rows only.",
            "Confirm the dataset readiness report is clean enough for the intended use.",
            "Confirm the feature is mapped to the same calculation in Pine.",
            "Inspect human-vs-rule disagreements before trusting the signal.",
            "Run walk-forward split evaluation after enough labels exist.",
            "Replace rough EXIT-vs-non-EXIT exit logic with an in-trade HOLD-vs-EXIT model before treating the Pine scaffold as a strategy.",
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


def pine_condition_lines(variable_prefix: str, candidate: dict[str, Any]) -> tuple[list[str], str]:
    feature = str(candidate.get("feature", ""))
    direction = comparison_operator(candidate.get("direction"))
    threshold = numeric_literal(candidate.get("threshold"))
    expression, comments = pine_expression(feature)
    lines = [f"// {comment}" for comment in comments]
    feature_variable = f"{variable_prefix}Feature"
    signal_variable = f"{variable_prefix}Signal"
    lines.extend([
        f"{feature_variable} = {expression}",
        f"{signal_variable} = not na({feature_variable}) and {feature_variable} {direction} {threshold}",
    ])
    return lines, signal_variable


def pine_pair_condition_lines(variable_prefix: str, candidate: dict[str, Any]) -> tuple[list[str], str]:
    conditions = candidate.get("conditions", [])
    if not isinstance(conditions, list) or not conditions:
        return ["// Pair candidate has no conditions.", f"{variable_prefix}Signal = false"], f"{variable_prefix}Signal"

    lines: list[str] = []
    condition_signals: list[str] = []
    for index, condition in enumerate(conditions, start=1):
        if not isinstance(condition, dict):
            lines.append("// Pair candidate contains a non-object condition.")
            continue
        feature = str(condition.get("feature", ""))
        direction = comparison_operator(condition.get("direction"))
        threshold = numeric_literal(condition.get("threshold"))
        expression, comments = pine_expression(feature)
        lines.extend(f"// {comment}" for comment in comments)
        feature_variable = f"{variable_prefix}Feature{index}"
        signal_variable = f"{variable_prefix}Condition{index}"
        lines.extend([
            f"{feature_variable} = {expression}",
            f"{signal_variable} = not na({feature_variable}) and {feature_variable} {direction} {threshold}",
        ])
        condition_signals.append(signal_variable)

    signal_variable = f"{variable_prefix}Signal"
    lines.append(f"{signal_variable} = {' and '.join(condition_signals) if condition_signals else 'false'}")
    return lines, signal_variable


def pair_rule_comment(prefix: str, candidate: dict[str, Any] | None) -> list[str]:
    if not candidate:
        return [f"// {prefix}: no candidate available"]
    conditions = candidate.get("conditions", [])
    if not isinstance(conditions, list) or not conditions:
        return [f"// {prefix}: no conditions available"]
    condition_text = " AND ".join(
        f"{condition.get('feature', '')} {comparison_operator(condition.get('direction'))} {numeric_literal(condition.get('threshold'))}"
        for condition in conditions
        if isinstance(condition, dict)
    )
    details: list[str] = []
    if "precision" in candidate:
        details.append(f"precision={float(candidate.get('precision', 0)):.4f}")
    if "recall" in candidate:
        details.append(f"recall={float(candidate.get('recall', 0)):.4f}")
    if "lift" in candidate:
        details.append(f"lift={float(candidate.get('lift', 0)):.4f}")
    suffix = f" ({', '.join(details)})" if details else ""
    return [f"// {prefix}: {condition_text}{suffix}"]


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
    human_pair_candidate: dict[str, Any] | None,
    return_candidate: dict[str, Any] | None,
    exit_candidate: dict[str, Any] | None,
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
    lines.extend(pair_rule_comment("Human-mimic pair candidate", human_pair_candidate))
    lines.extend(rule_comment("Return-optimized candidate", return_candidate))
    lines.extend(rule_comment("Rough exit candidate", exit_candidate))
    lines.append("")

    if human_pair_candidate and pine_pair_support(human_pair_candidate)["supported"]:
        pair_lines, signal_variable = pine_pair_condition_lines("candidatePair", human_pair_candidate)
        lines.extend(pair_lines)
        lines.append(f"candidateSignal = {signal_variable}")
    elif human_candidate:
        condition_lines, signal_variable = pine_condition_lines("candidate", human_candidate)
        lines.extend(condition_lines)
        lines.append(f"candidateSignal = {signal_variable}")
    else:
        lines.extend([
            "// No human-mimic candidate rule is available yet.",
            "// Add replay-safe ENTRY and SKIP labels, then rerun `pnpm research:report`.",
            "candidateSignal = false",
        ])

    if exit_candidate and pine_feature_support(exit_candidate)["supported"]:
        exit_lines, exit_signal_variable = pine_condition_lines("exitCandidate", exit_candidate)
        lines.extend(["", "// Rough EXIT-vs-non-EXIT scaffold. Replace with in-trade HOLD-vs-EXIT logic before promotion."])
        lines.extend(exit_lines)
        lines.append(f"exitCandidateSignal = {exit_signal_variable}")
    else:
        lines.extend([
            "",
            "// No Pine-supported exit candidate is available yet.",
            "exitCandidateSignal = false",
        ])

    lines.extend([
        "",
        'plotshape(candidateSignal, title="Candidate ENTRY", style=shape.triangleup, location=location.belowbar, size=size.tiny)',
        'plotshape(exitCandidateSignal, title="Candidate EXIT", style=shape.triangledown, location=location.abovebar, size=size.tiny)',
        'if candidateSignal and strategy.position_size == 0',
        '    strategy.entry("Candidate Long", strategy.long)',
        'if exitCandidateSignal and strategy.position_size > 0',
        '    strategy.close("Candidate Long")',
        "",
        "// Exit logic is intentionally rough.",
        "// EdgeLord needs explicit in-trade candidate rows or stronger exported exit logic before this becomes a complete strategy.",
    ])
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate EdgeLord strategy-rules JSON and a Pine Script scaffold.")
    parser.add_argument("--rules-json", required=True, type=Path, help="Path to candidate-rules.json")
    parser.add_argument("--return-rules-json", type=Path, help="Optional path to return-rules.json")
    parser.add_argument("--exit-rules-json", type=Path, help="Optional path to exit-rules.json")
    parser.add_argument("--dataset-report-json", type=Path, help="Optional path to dataset-report.json")
    parser.add_argument("--rules-output", required=True, type=Path, help="Path to write strategy_rules.v1.json")
    parser.add_argument("--pine-output", required=True, type=Path, help="Path to write strategy_soxl_soxs.pine")
    args = parser.parse_args()

    candidate_rules = read_rules(args.rules_json)
    human_candidate = top_candidate(candidate_rules)
    human_pair_candidate = top_pair_candidate(candidate_rules)
    return_candidate = top_candidate(read_rules(args.return_rules_json)) if args.return_rules_json else None
    exit_candidate = top_candidate(read_rules(args.exit_rules_json)) if args.exit_rules_json else None
    dataset_report = read_optional_object(args.dataset_report_json, "dataset report")

    args.rules_output.parent.mkdir(parents=True, exist_ok=True)
    args.rules_output.write_text(
        f"{json.dumps(strategy_rules_payload(args.rules_json, human_candidate, human_pair_candidate, args.return_rules_json, return_candidate, args.exit_rules_json, exit_candidate, dataset_report), indent=2)}\n"
    )

    args.pine_output.parent.mkdir(parents=True, exist_ok=True)
    args.pine_output.write_text(pine_stub(human_candidate, human_pair_candidate, return_candidate, exit_candidate, dataset_report))


if __name__ == "__main__":
    main()
