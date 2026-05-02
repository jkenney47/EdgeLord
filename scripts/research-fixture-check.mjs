#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "edgelord-research-check-"));

function run(args) {
  execFileSync("python3", args, {
    cwd: root,
    stdio: "pipe"
  });
}

function runNode(args, options = {}) {
  return execFileSync("node", args, {
    cwd: root,
    stdio: "pipe",
    ...options
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function writeFile(name, body) {
  const target = path.join(tempDir, name);
  fs.writeFileSync(target, body);
  return target;
}

function readFile(name) {
  return fs.readFileSync(path.join(tempDir, name), "utf8");
}

function writeResearchSummaryFixture() {
  const summary = {
    version: "edgelord.research_summary.v1",
    createdAt: "2024-01-01T00:00:00.000Z",
    apiBaseUrl: "fixture",
    slug: "fixture",
    artifacts: {
      pineStrategy: "reports/fixture-strategy-soxl-soxs.pine",
      strategyRules: "reports/fixture-strategy-rules.v1.json",
    },
    exports: [],
    topHumanMimicRule: null,
    topReturnOptimizedRule: null,
  };
  writeFile("research-summary.json", `${JSON.stringify(summary, null, 2)}\n`);
}

const labelsCsv = writeFile("labels.csv", [
  "id,label_source,training_eligible,action,ticker,timeframe,timestamp,bar_index,chart_price,execution_price,trade_id,parent_entry_label_id,capture_mode,visible_until_timestamp,potential_visual_leakage,confidence,setup_quality,reason_codes,notes,created_at",
  "l1,retrospective_replay,1,ENTRY,SOXL,4H,2024-01-02T14:30:00.000Z,0,10,,t1,,replay,2024-01-02T14:30:00.000Z,0,,,,2024-01-02T14:30:00.000Z",
  "l2,retrospective_replay,1,EXIT,SOXL,4H,2024-01-03T14:30:00.000Z,1,11,,t1,l1,replay,2024-01-03T14:30:00.000Z,0,,,,2024-01-03T14:30:00.000Z",
  "l2_orphan,retrospective_replay,0,EXIT,SOXL,4H,2024-01-03T18:30:00.000Z,2,10.8,,,,replay,2024-01-03T18:30:00.000Z,0,,,,2024-01-03T18:30:00.000Z",
  "l3,retrospective_replay,1,SKIP,SOXL,4H,2024-01-04T14:30:00.000Z,2,9,,,,replay,2024-01-04T14:30:00.000Z,0,,,,2024-01-04T14:30:00.000Z",
  "l4,retrospective_hindsight,0,SKIP,SOXS,4H,2024-01-05T14:30:00.000Z,3,8,,,,regular,2024-01-05T14:30:00.000Z,1,,,,2024-01-05T14:30:00.000Z",
  "l5,retrospective_replay,1,ENTRY,SOXS,4H,2024-01-06T14:30:00.000Z,4,20,,t2,,replay,2024-01-06T14:30:00.000Z,0,,,,2024-01-06T14:30:00.000Z",
  "l6,retrospective_replay,1,EXIT,SOXS,4H,2024-01-07T14:30:00.000Z,5,18,,t2,l5,replay,2024-01-07T14:30:00.000Z,0,,,,2024-01-07T14:30:00.000Z"
].join("\n") + "\n");

const trainingCsv = writeFile("training-features.csv", [
  "label_id,label_source,capture_mode,action,target_entry,target_exit,target_skip,target_invalid,ticker,timeframe,timestamp,trade_id,parent_entry_label_id,chart_price,execution_price,decision_price,visible_until_timestamp,feature_close,feature_ema25,feature_sma100,feature_atr14,feature_stoch_rsi_k,feature_stoch_rsi_d,feature_close_above_ema25,feature_close_above_sma100,feature_distance_to_ema25_pct,feature_distance_to_sma100_pct,feature_recent_5_return_pct,feature_recent_10_return_pct,feature_recent_20_return_pct,feature_recent_20_high,feature_recent_20_low,feature_close_rank_recent_20,feature_paired_ticker,feature_paired_close,feature_pair_ratio_close,feature_d1_close,feature_d1_close_above_ema25,feature_h4_close,feature_h4_close_above_ema25,feature_h2_close,feature_h2_close_above_ema25",
  "l1,retrospective_replay,replay,ENTRY,1,0,0,0,SOXL,4H,2024-01-02T14:30:00.000Z,t1,,10,,10,2024-01-02T14:30:00.000Z,10,9,8,0.5,22,18,true,true,11.1,25,3,6,9,10,7,1,SOXS,90,0.111,10,true,10,true,10,true",
  "l2,retrospective_replay,replay,EXIT,0,1,0,0,SOXL,4H,2024-01-03T14:30:00.000Z,t1,l1,11,,11,2024-01-03T14:30:00.000Z,11,9.5,8.5,0.6,70,65,true,true,15.7,29,4,7,10,11,7,1,SOXS,88,0.125,11,true,11,true,11,true",
  "l3,retrospective_replay,replay,SKIP,0,0,1,0,SOXL,4H,2024-01-04T14:30:00.000Z,,,9,,9,2024-01-04T14:30:00.000Z,9,9.2,8.8,0.4,45,48,false,true,-2.2,2,1,2,3,10,7,0.66,SOXS,91,0.099,9,false,9,false,9,false",
  "l5,retrospective_replay,replay,ENTRY,1,0,0,0,SOXS,4H,2024-01-06T14:30:00.000Z,t2,,20,,20,2024-01-06T14:30:00.000Z,20,21,19,0.9,82,79,false,true,-4.8,5.2,-2,-1,0,22,18,0.5,SOXL,10,2,20,false,20,false,20,false",
  "l6,retrospective_replay,replay,EXIT,0,1,0,0,SOXS,4H,2024-01-07T14:30:00.000Z,t2,l5,18,,18,2024-01-07T14:30:00.000Z,18,20,19,1.1,30,35,false,false,-10,-5,-4,-6,-8,22,18,0,SOXL,11,1.636,18,false,18,false,18,false"
].join("\n") + "\n");

const tradesCsv = writeFile("trades.csv", [
  "trade_id,ticker,status,entry_label_id,exit_label_id,entry_timestamp,exit_timestamp,entry_price,exit_price,return_pct",
  "t1,SOXL,closed,l1,l2,2024-01-02T14:30:00.000Z,2024-01-03T14:30:00.000Z,10,11,10",
  "t2,SOXS,closed,l5,l6,2024-01-06T14:30:00.000Z,2024-01-07T14:30:00.000Z,20,18,-10"
].join("\n") + "\n");

const tradeCandidatesCsv = writeFile("trade-candidates.csv", [
  "candidate_id,trade_id,entry_label_id,exit_label_id,action,target_exit,target_hold,ticker,timeframe,timestamp,bar_index,in_trade_bar_index,chart_price,entry_timestamp,exit_timestamp,entry_price,exit_price,return_pct,feature_close,feature_ema25,feature_sma100,feature_atr14,feature_stoch_rsi_k,feature_stoch_rsi_d,feature_close_above_ema25,feature_close_above_sma100,feature_distance_to_ema25_pct,feature_distance_to_sma100_pct,feature_recent_5_return_pct,feature_recent_10_return_pct,feature_recent_20_return_pct,feature_recent_20_high,feature_recent_20_low,feature_close_rank_recent_20,feature_paired_ticker,feature_paired_close,feature_pair_ratio_close,feature_d1_close,feature_d1_close_above_ema25,feature_h4_close,feature_h4_close_above_ema25,feature_h2_close,feature_h2_close_above_ema25",
  "t1:hold,t1,l1,l2,HOLD,0,1,SOXL,4H,2024-01-02T18:30:00.000Z,1,1,10.5,2024-01-02T14:30:00.000Z,2024-01-03T14:30:00.000Z,10,11,10,10.5,9.2,8.2,0.5,35,38,true,true,14.1,28,3,6,9,10.5,7,0.87,SOXS,89,0.118,10.5,true,10.5,true,10.5,true",
  "t1:exit,t1,l1,l2,EXIT,1,0,SOXL,4H,2024-01-03T14:30:00.000Z,2,2,11,2024-01-02T14:30:00.000Z,2024-01-03T14:30:00.000Z,10,11,10,11,9.5,8.5,0.6,70,65,true,true,15.7,29,4,7,10,11,7,1,SOXS,88,0.125,11,true,11,true,11,true",
  "t2:hold,t2,l5,l6,HOLD,0,1,SOXS,4H,2024-01-06T18:30:00.000Z,5,1,19,2024-01-06T14:30:00.000Z,2024-01-07T14:30:00.000Z,20,18,-10,19,20.5,19,0.8,55,58,false,true,-7.3,0,-2,-1,0,22,18,0.25,SOXL,10.5,1.81,19,false,19,false,19,false",
  "t2:exit,t2,l5,l6,EXIT,1,0,SOXS,4H,2024-01-07T14:30:00.000Z,6,2,18,2024-01-06T14:30:00.000Z,2024-01-07T14:30:00.000Z,20,18,-10,18,20,19,1.1,30,35,false,false,-10,-5,-4,-6,-8,22,18,0,SOXL,11,1.636,18,false,18,false,18,false"
].join("\n") + "\n");

try {
  run([
    "research/dataset_report.py",
    "--labels", labelsCsv,
    "--training", trainingCsv,
    "--trades", tradesCsv,
    "--output", path.join(tempDir, "dataset-report.md"),
    "--json-output", path.join(tempDir, "dataset-report.json")
  ]);
  assert(readFile("dataset-report.md").includes("entry labels are still early:"), "dataset report should include readiness guidance");
  assert(readFile("dataset-report.md").includes("Training Label Sources"), "dataset report should include training source counts");
  assert(readFile("dataset-report.md").includes("State Machine Sequence Issues"), "dataset report should include state-machine sequence diagnostics");
  assert(readFile("dataset-report.md").includes("Training Row Consistency"), "dataset report should include training row consistency diagnostics");
  assert(readFile("dataset-report.md").includes("eligible labels match training rows"), "fixture training rows should match eligible labels");
  const datasetReport = JSON.parse(readFile("dataset-report.json"));
  assert(datasetReport.version === "edgelord.dataset_report.v1", "dataset report JSON should carry the expected version");
  assert(datasetReport.counts.orphanExits === 0, "dataset report should ignore excluded orphan exits");
  assert(datasetReport.counts.sequenceIssues === 0, "dataset report JSON should count sequence issues");
  assert(datasetReport.counts.missingEligibleTrainingRows === 0, "dataset report should count missing eligible training rows");
  assert(datasetReport.counts.extraTrainingRows === 0, "dataset report should count extra training rows");
  assert(datasetReport.counts.duplicateTrainingRows === 0, "dataset report should count duplicate training rows");
  assert(Array.isArray(datasetReport.issues.trainingRows.missingEligibleLabelIds), "dataset report should expose training row issue ids");
  assert(datasetReport.readiness.readyForRuleMining === true, "fixture dataset should be ready for basic rule mining");
  assert(datasetReport.readiness.readyForRoughRuleMining === false, "fixture dataset should stay below rough rule-mining targets");
  assert(datasetReport.readiness.targets.roughRuleMiningDecisionRows === 300, "dataset report JSON should include rough decision target");

  run(["research/discover_rules.py", "--training", trainingCsv, "--output", path.join(tempDir, "candidate-rules.md"), "--json-output", path.join(tempDir, "candidate-rules.json")]);
  const rules = JSON.parse(readFile("candidate-rules.json"));
  assert(Array.isArray(rules.candidates) && rules.candidates.length > 0, "candidate rules should include at least one rule");
  assert(Array.isArray(rules.pairCandidates) && rules.pairCandidates.length > 0, "candidate rules should include pair candidates");
  assert(Array.isArray(rules.pairCandidates[0].conditions), "pair candidates should carry explicit conditions");
  assert(readFile("candidate-rules.md").includes("Top Candidates"), "candidate rules report should include top candidates");
  assert(readFile("candidate-rules.md").includes("Top Pair Candidates"), "candidate rules report should include pair candidates");

  const topRule = rules.candidates[0];
  run([
    "research/compare_rule.py",
    "--training", trainingCsv,
    "--feature", topRule.feature,
    "--direction", topRule.direction,
    "--threshold", String(topRule.threshold),
    "--output", path.join(tempDir, "human-vs-rule.md"),
    "--csv-output", path.join(tempDir, "human-vs-rule.csv")
  ]);
  assert(readFile("human-vs-rule.md").includes("EdgeLord Human vs Rule Comparison"), "comparison report should be written");
  assert(readFile("human-vs-rule.md").includes("Disagreement Context"), "comparison report should include disagreement context");
  assert(readFile("human-vs-rule.md").includes("Why Disagreements Cluster"), "comparison report should include disagreement feature clusters");

  run([
    "research/compare_rule.py",
    "--training", trainingCsv,
    "--conditions-json", JSON.stringify(rules.pairCandidates[0].conditions),
    "--output", path.join(tempDir, "human-vs-pair-rule.md"),
    "--csv-output", path.join(tempDir, "human-vs-pair-rule.csv")
  ]);
  assert(readFile("human-vs-pair-rule.md").includes("EdgeLord Human vs Pair Rule Comparison"), "pair comparison report should be written");
  assert(readFile("human-vs-pair-rule.csv").startsWith("label_id,timestamp,ticker,timeframe"), "pair comparison CSV should have expected header");

  run(["research/time_splits.py", "--training", trainingCsv, "--output", path.join(tempDir, "time-splits.md"), "--csv-output", path.join(tempDir, "time-splits.csv")]);
  assert(readFile("time-splits.csv").startsWith("split,label_id"), "time splits CSV should have expected header");

  run([
    "research/split_rule_eval.py",
    "--training", trainingCsv,
    "--splits", path.join(tempDir, "time-splits.csv"),
    "--feature", topRule.feature,
    "--direction", topRule.direction,
    "--threshold", String(topRule.threshold),
    "--output", path.join(tempDir, "split-rule-eval.md"),
    "--csv-output", path.join(tempDir, "split-rule-eval.csv")
  ]);
  assert(readFile("split-rule-eval.md").includes("EdgeLord Split Rule Evaluation"), "split rule eval report should be written");

  run([
    "research/split_rule_eval.py",
    "--training", trainingCsv,
    "--splits", path.join(tempDir, "time-splits.csv"),
    "--conditions-json", JSON.stringify(rules.pairCandidates[0].conditions),
    "--output", path.join(tempDir, "split-pair-rule-eval.md"),
    "--csv-output", path.join(tempDir, "split-pair-rule-eval.csv")
  ]);
  assert(readFile("split-pair-rule-eval.md").includes("EdgeLord Split Pair Rule Evaluation"), "split pair rule eval report should be written");

  run([
    "research/entry_outcome_analysis.py",
    "--training", trainingCsv,
    "--trades", tradesCsv,
    "--output", path.join(tempDir, "entry-outcomes.md"),
    "--csv-output", path.join(tempDir, "entry-outcomes.csv")
  ]);
  assert(readFile("entry-outcomes.md").includes("EdgeLord Entry Outcome Analysis"), "entry outcome report should be written");
  assert(readFile("entry-outcomes.csv").includes("l1,SOXL,4H"), "entry outcome CSV should include the closed entry row");

  run([
    "research/optimize_entry_rules.py",
    "--training", trainingCsv,
    "--trades", tradesCsv,
    "--output", path.join(tempDir, "return-rules.md"),
    "--json-output", path.join(tempDir, "return-rules.json")
  ]);
  assert(readFile("return-rules.md").includes("EdgeLord Return-Optimized Entry Rules"), "return rules report should be written");
  assert(JSON.parse(readFile("return-rules.json")).candidates.length > 0, "return rules JSON should include candidates");

  run([
    "research/discover_exit_rules.py",
    "--training", trainingCsv,
    "--candidates", tradeCandidatesCsv,
    "--output", path.join(tempDir, "exit-rules.md"),
    "--json-output", path.join(tempDir, "exit-rules.json")
  ]);
  assert(readFile("exit-rules.md").includes("EdgeLord Exit Rule Candidates"), "exit rules report should be written");
  assert(readFile("exit-rules.md").includes("source: trade_candidates"), "exit rules should prefer in-trade candidates");
  assert(JSON.parse(readFile("exit-rules.json")).candidates.length > 0, "exit rules JSON should include candidates");

  run([
    "research/generate_pine_stub.py",
    "--rules-json", path.join(tempDir, "candidate-rules.json"),
    "--return-rules-json", path.join(tempDir, "return-rules.json"),
    "--exit-rules-json", path.join(tempDir, "exit-rules.json"),
    "--dataset-report-json", path.join(tempDir, "dataset-report.json"),
    "--rules-output", path.join(tempDir, "strategy-rules.v1.json"),
    "--pine-output", path.join(tempDir, "strategy-soxl-soxs.pine")
  ]);
  const strategyRules = JSON.parse(readFile("strategy-rules.v1.json"));
  assert(strategyRules.humanMimicTopRule, "strategy rules JSON should include the human rule");
  assert(strategyRules.humanMimicTopPairRule, "strategy rules JSON should include the human pair rule");
  assert(strategyRules.returnOptimizedTopRule, "strategy rules JSON should include the return rule");
  assert(strategyRules.exitTopRule, "strategy rules JSON should include the exit rule");
  assert(strategyRules.datasetReadiness?.readiness?.readyForRuleMining === true, "strategy rules JSON should include dataset rule-mining readiness");
  assert(strategyRules.datasetReadiness?.readiness?.readyForRoughRuleMining === false, "strategy rules JSON should include rough dataset readiness");
  assert(strategyRules.promotion?.status === "scaffold_only", "strategy rules JSON should block promotion below rough targets");
  assert(strategyRules.pineSupport?.humanMimicTopRule, "strategy rules JSON should include Pine feature support for the human rule");
  assert(strategyRules.pineSupport?.humanMimicTopPairRule, "strategy rules JSON should include Pine feature support for the human pair rule");
  assert(strategyRules.pineSupport?.exitTopRule, "strategy rules JSON should include Pine feature support for the exit rule");
  assert(Array.isArray(strategyRules.promotionChecklist), "strategy rules JSON should include a promotion checklist");
  assert(readFile("strategy-soxl-soxs.pine").includes("strategy(\"EdgeLord SOXL/SOXS Candidate Scaffold\""), "Pine scaffold should be written");
  assert(readFile("strategy-soxl-soxs.pine").includes("Dataset rule-mining readiness: ready"), "Pine scaffold should include dataset rule-mining readiness");
  assert(readFile("strategy-soxl-soxs.pine").includes("Rough rule-mining target: not ready"), "Pine scaffold should include rough rule-mining readiness");
  assert(readFile("strategy-soxl-soxs.pine").includes("Human-mimic pair candidate"), "Pine scaffold should mention the human pair candidate");
  assert(readFile("strategy-soxl-soxs.pine").includes("Return-optimized candidate"), "Pine scaffold should mention the return candidate");
  assert(readFile("strategy-soxl-soxs.pine").includes("Rough exit candidate"), "Pine scaffold should mention the exit candidate");
  assert(readFile("strategy-soxl-soxs.pine").includes("strategy.close(\"Candidate Long\")"), "Pine scaffold should include rough close logic");
  writeResearchSummaryFixture();
  const summary = JSON.parse(readFile("research-summary.json"));
  assert(summary.version === "edgelord.research_summary.v1", "research summary should carry the expected version");
  assert(summary.artifacts.pineStrategy, "research summary should include artifact paths");

  runNode(["scripts/validate-csv.mjs", "data/sample-bars.csv", "--json-output", path.join(tempDir, "csv-validation.json")]);
  const csvValidation = JSON.parse(readFile("csv-validation.json"));
  assert(csvValidation.version === "edgelord.csv_validation.v1", "CSV validation JSON should carry the expected version");
  assert(csvValidation.importable === true, "sample CSV should be importable");
  assert(csvValidation.researchReady === false, "sample CSV should not be research-ready");
  const duplicateCsv = writeFile("duplicate-bars.csv", [
    "ticker,timestamp,open,high,low,close,volume",
    "SOXL,2024-01-02T14:30:00.000Z,10,11,9,10.5,1000",
    "SOXL,2024-01-02T14:30:00.000Z,10,11,9,10.5,1000",
    "SOXS,2024-01-02T14:30:00.000Z,20,21,19,20.5,2000"
  ].join("\n") + "\n");
  try {
    runNode(["scripts/validate-csv.mjs", duplicateCsv]);
    throw new Error("duplicate ticker timestamps should not pass CSV validation");
  } catch (error) {
    assert(error.status === 1, "duplicate ticker timestamps should fail with exit code 1");
  }
  try {
    runNode(["scripts/validate-csv.mjs", "data/sample-bars.csv", "--research-ready"]);
    throw new Error("sample bars should not pass research-ready validation");
  } catch (error) {
    assert(error.status === 1, "research-ready validation should fail with exit code 1 for sample bars");
  }

  console.log("ok research fixture check");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
