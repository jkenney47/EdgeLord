#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4317";
const exportsDir = path.join(root, "exports");
const reportsDir = path.join(root, "reports");
const exportFiles = [
  ["labels.csv", "/export/labels.csv"],
  ["trades.csv", "/export/trades.csv"],
  ["training-features.csv", "/export/training-features.csv"],
  ["labels.jsonl", "/export/labels.jsonl"],
  ["manifest.api.json", "/export/manifest.json"]
];

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[-:.]/g, "");
}

async function download(route, target) {
  const response = await fetch(`${baseUrl}${route}`);
  if (!response.ok) {
    throw new Error(`${route} returned ${response.status}. Start the API with pnpm dev or set API_BASE_URL.`);
  }
  const body = await response.text();
  fs.writeFileSync(target, body);
  return Buffer.byteLength(body, "utf8");
}

fs.mkdirSync(exportsDir, { recursive: true });
fs.mkdirSync(reportsDir, { recursive: true });

const slug = timestampSlug();
const backupDir = path.join(exportsDir, slug);
const reportPath = path.join(reportsDir, `${slug}-dataset-report.md`);
const rulesPath = path.join(reportsDir, `${slug}-candidate-rules.md`);
const rulesJsonPath = path.join(reportsDir, `${slug}-candidate-rules.json`);
const comparisonPath = path.join(reportsDir, `${slug}-human-vs-rule.md`);
const comparisonCsvPath = path.join(reportsDir, `${slug}-human-vs-rule.csv`);
const timeSplitsPath = path.join(reportsDir, `${slug}-time-splits.md`);
const timeSplitsCsvPath = path.join(reportsDir, `${slug}-time-splits.csv`);
const splitRuleEvalPath = path.join(reportsDir, `${slug}-split-rule-eval.md`);
const splitRuleEvalCsvPath = path.join(reportsDir, `${slug}-split-rule-eval.csv`);
const entryOutcomePath = path.join(reportsDir, `${slug}-entry-outcomes.md`);
const entryOutcomeCsvPath = path.join(reportsDir, `${slug}-entry-outcomes.csv`);
const returnRulesPath = path.join(reportsDir, `${slug}-return-rules.md`);
const returnRulesJsonPath = path.join(reportsDir, `${slug}-return-rules.json`);
const strategyRulesPath = path.join(reportsDir, `${slug}-strategy-rules.v1.json`);
const pineStrategyPath = path.join(reportsDir, `${slug}-strategy-soxl-soxs.pine`);
const researchSummaryPath = path.join(reportsDir, `${slug}-research-summary.json`);
fs.mkdirSync(backupDir);

const files = [];
for (const [name, route] of exportFiles) {
  const target = path.join(backupDir, name);
  const bytes = await download(route, target);
  files.push({ name, route, bytes });
}

fs.writeFileSync(path.join(backupDir, "manifest.json"), `${JSON.stringify({
  createdAt: new Date().toISOString(),
  apiBaseUrl: baseUrl,
  files,
  report: path.relative(root, reportPath),
  candidateRules: path.relative(root, rulesPath),
  candidateRulesJson: path.relative(root, rulesJsonPath),
  humanVsRule: path.relative(root, comparisonPath),
  humanVsRuleCsv: path.relative(root, comparisonCsvPath),
  timeSplits: path.relative(root, timeSplitsPath),
  timeSplitsCsv: path.relative(root, timeSplitsCsvPath),
  splitRuleEval: path.relative(root, splitRuleEvalPath),
  splitRuleEvalCsv: path.relative(root, splitRuleEvalCsvPath),
  entryOutcomes: path.relative(root, entryOutcomePath),
  entryOutcomesCsv: path.relative(root, entryOutcomeCsvPath),
  returnRules: path.relative(root, returnRulesPath),
  returnRulesJson: path.relative(root, returnRulesJsonPath),
  strategyRules: path.relative(root, strategyRulesPath),
  pineStrategy: path.relative(root, pineStrategyPath),
  researchSummary: path.relative(root, researchSummaryPath)
}, null, 2)}\n`);

execFileSync("python3", [
  "research/dataset_report.py",
  "--labels", path.join(backupDir, "labels.csv"),
  "--training", path.join(backupDir, "training-features.csv"),
  "--trades", path.join(backupDir, "trades.csv"),
  "--output", reportPath
], {
  cwd: root,
  stdio: "inherit"
});

execFileSync("python3", [
  "research/discover_rules.py",
  "--training", path.join(backupDir, "training-features.csv"),
  "--output", rulesPath,
  "--json-output", rulesJsonPath
], {
  cwd: root,
  stdio: "inherit"
});

const rules = JSON.parse(fs.readFileSync(rulesJsonPath, "utf8"));
const topRule = rules.candidates?.[0];
if (topRule) {
  execFileSync("python3", [
    "research/compare_rule.py",
    "--training", path.join(backupDir, "training-features.csv"),
    "--feature", topRule.feature,
    "--direction", topRule.direction,
    "--threshold", String(topRule.threshold),
    "--output", comparisonPath,
    "--csv-output", comparisonCsvPath
  ], {
    cwd: root,
    stdio: "inherit"
  });
} else {
  const report = [
    "EdgeLord Human vs Rule Comparison",
    "=================================",
    "No candidate rule is available yet.",
    "",
    "Add replay-safe ENTRY and SKIP labels, then rerun `pnpm research:report`."
  ].join("\n") + "\n";
  fs.writeFileSync(comparisonPath, report);
  fs.writeFileSync(comparisonCsvPath, "label_id,timestamp,ticker,timeframe,human_action,model_action,category,feature,direction,threshold,feature_value\n");
  console.log(report);
}

execFileSync("python3", [
  "research/time_splits.py",
  "--training", path.join(backupDir, "training-features.csv"),
  "--output", timeSplitsPath,
  "--csv-output", timeSplitsCsvPath
], {
  cwd: root,
  stdio: "inherit"
});

if (topRule) {
  execFileSync("python3", [
    "research/split_rule_eval.py",
    "--training", path.join(backupDir, "training-features.csv"),
    "--splits", timeSplitsCsvPath,
    "--feature", topRule.feature,
    "--direction", topRule.direction,
    "--threshold", String(topRule.threshold),
    "--output", splitRuleEvalPath,
    "--csv-output", splitRuleEvalCsvPath
  ], {
    cwd: root,
    stdio: "inherit"
  });
} else {
  const report = [
    "EdgeLord Split Rule Evaluation",
    "==============================",
    "No candidate rule is available yet.",
    "",
    "Add replay-safe ENTRY and SKIP labels, then rerun `pnpm research:report`."
  ].join("\n") + "\n";
  fs.writeFileSync(splitRuleEvalPath, report);
  fs.writeFileSync(splitRuleEvalCsvPath, "split,rows,human_entries,model_entries,precision,recall,agreement,true_positive,false_positive,false_negative,true_negative\n");
  console.log(report);
}

execFileSync("python3", [
  "research/entry_outcome_analysis.py",
  "--training", path.join(backupDir, "training-features.csv"),
  "--trades", path.join(backupDir, "trades.csv"),
  "--output", entryOutcomePath,
  "--csv-output", entryOutcomeCsvPath
], {
  cwd: root,
  stdio: "inherit"
});

execFileSync("python3", [
  "research/optimize_entry_rules.py",
  "--training", path.join(backupDir, "training-features.csv"),
  "--trades", path.join(backupDir, "trades.csv"),
  "--output", returnRulesPath,
  "--json-output", returnRulesJsonPath
], {
  cwd: root,
  stdio: "inherit"
});

execFileSync("python3", [
  "research/generate_pine_stub.py",
  "--rules-json", rulesJsonPath,
  "--return-rules-json", returnRulesJsonPath,
  "--rules-output", strategyRulesPath,
  "--pine-output", pineStrategyPath
], {
  cwd: root,
  stdio: "inherit"
});

const returnRules = JSON.parse(fs.readFileSync(returnRulesJsonPath, "utf8"));
const artifacts = {
  exportBackup: path.relative(root, backupDir),
  datasetReport: path.relative(root, reportPath),
  candidateRules: path.relative(root, rulesPath),
  candidateRulesJson: path.relative(root, rulesJsonPath),
  humanVsRule: path.relative(root, comparisonPath),
  humanVsRuleCsv: path.relative(root, comparisonCsvPath),
  timeSplits: path.relative(root, timeSplitsPath),
  timeSplitsCsv: path.relative(root, timeSplitsCsvPath),
  splitRuleEval: path.relative(root, splitRuleEvalPath),
  splitRuleEvalCsv: path.relative(root, splitRuleEvalCsvPath),
  entryOutcomes: path.relative(root, entryOutcomePath),
  entryOutcomesCsv: path.relative(root, entryOutcomeCsvPath),
  returnRules: path.relative(root, returnRulesPath),
  returnRulesJson: path.relative(root, returnRulesJsonPath),
  strategyRules: path.relative(root, strategyRulesPath),
  pineStrategy: path.relative(root, pineStrategyPath)
};
fs.writeFileSync(researchSummaryPath, `${JSON.stringify({
  version: "edgelord.research_summary.v1",
  createdAt: new Date().toISOString(),
  apiBaseUrl: baseUrl,
  slug,
  artifacts,
  exports: files,
  topHumanMimicRule: topRule ?? null,
  topReturnOptimizedRule: returnRules.candidates?.[0] ?? null
}, null, 2)}\n`);

console.log(`backup: ${path.relative(root, backupDir)}`);
console.log(`report: ${path.relative(root, reportPath)}`);
console.log(`candidate_rules: ${path.relative(root, rulesPath)}`);
console.log(`human_vs_rule: ${path.relative(root, comparisonPath)}`);
console.log(`time_splits: ${path.relative(root, timeSplitsPath)}`);
console.log(`split_rule_eval: ${path.relative(root, splitRuleEvalPath)}`);
console.log(`entry_outcomes: ${path.relative(root, entryOutcomePath)}`);
console.log(`return_rules: ${path.relative(root, returnRulesPath)}`);
console.log(`strategy_rules: ${path.relative(root, strategyRulesPath)}`);
console.log(`pine_strategy: ${path.relative(root, pineStrategyPath)}`);
console.log(`research_summary: ${path.relative(root, researchSummaryPath)}`);
