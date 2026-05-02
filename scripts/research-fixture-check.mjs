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

const labelsCsv = writeFile("labels.csv", [
  "id,label_source,training_eligible,action,ticker,timeframe,timestamp,bar_index,chart_price,execution_price,trade_id,parent_entry_label_id,capture_mode,visible_until_timestamp,potential_visual_leakage,confidence,setup_quality,reason_codes,notes,created_at",
  "l1,retrospective_replay,1,ENTRY,SOXL,4H,2024-01-02T14:30:00.000Z,0,10,,t1,,replay,2024-01-02T14:30:00.000Z,0,,,,2024-01-02T14:30:00.000Z",
  "l2,retrospective_replay,1,EXIT,SOXL,4H,2024-01-03T14:30:00.000Z,1,11,,t1,l1,replay,2024-01-03T14:30:00.000Z,0,,,,2024-01-03T14:30:00.000Z",
  "l3,retrospective_replay,1,SKIP,SOXL,4H,2024-01-04T14:30:00.000Z,2,9,,,,replay,2024-01-04T14:30:00.000Z,0,,,,2024-01-04T14:30:00.000Z",
  "l4,retrospective_hindsight,0,SKIP,SOXS,4H,2024-01-05T14:30:00.000Z,3,8,,,,regular,2024-01-05T14:30:00.000Z,1,,,,2024-01-05T14:30:00.000Z"
].join("\n") + "\n");

const trainingCsv = writeFile("training-features.csv", [
  "label_id,action,ticker,timeframe,timestamp,trade_id,parent_entry_label_id,chart_price,feature_close,feature_ema25,feature_sma100,feature_atr14,feature_stoch_rsi_k,feature_stoch_rsi_d,feature_close_above_ema25,feature_close_above_sma100,feature_distance_to_ema25_pct,feature_distance_to_sma100_pct,feature_recent_5_return_pct,feature_recent_10_return_pct,feature_recent_20_return_pct,feature_recent_20_high,feature_recent_20_low,feature_close_rank_recent_20,feature_paired_ticker,feature_paired_close,feature_pair_ratio_close,feature_d1_close,feature_d1_close_above_ema25,feature_h4_close,feature_h4_close_above_ema25,feature_h2_close,feature_h2_close_above_ema25",
  "l1,ENTRY,SOXL,4H,2024-01-02T14:30:00.000Z,t1,,10,10,9,8,0.5,22,18,true,true,11.1,25,3,6,9,10,7,1,SOXS,90,0.111,10,true,10,true,10,true",
  "l2,EXIT,SOXL,4H,2024-01-03T14:30:00.000Z,t1,l1,11,11,9.5,8.5,0.6,70,65,true,true,15.7,29,4,7,10,11,7,1,SOXS,88,0.125,11,true,11,true,11,true",
  "l3,SKIP,SOXL,4H,2024-01-04T14:30:00.000Z,,,9,9,9.2,8.8,0.4,45,48,false,true,-2.2,2,1,2,3,10,7,0.66,SOXS,91,0.099,9,false,9,false,9,false"
].join("\n") + "\n");

const tradesCsv = writeFile("trades.csv", [
  "trade_id,ticker,status,entry_label_id,exit_label_id,entry_timestamp,exit_timestamp,entry_price,exit_price,return_pct",
  "t1,SOXL,closed,l1,l2,2024-01-02T14:30:00.000Z,2024-01-03T14:30:00.000Z,10,11,10"
].join("\n") + "\n");

try {
  run(["research/dataset_report.py", "--labels", labelsCsv, "--training", trainingCsv, "--trades", tradesCsv, "--output", path.join(tempDir, "dataset-report.md")]);
  assert(readFile("dataset-report.md").includes("entry labels are still early: 1/100"), "dataset report should include readiness guidance");

  run(["research/discover_rules.py", "--training", trainingCsv, "--output", path.join(tempDir, "candidate-rules.md"), "--json-output", path.join(tempDir, "candidate-rules.json")]);
  const rules = JSON.parse(readFile("candidate-rules.json"));
  assert(Array.isArray(rules.candidates) && rules.candidates.length > 0, "candidate rules should include at least one rule");
  assert(readFile("candidate-rules.md").includes("Top Candidates"), "candidate rules report should include top candidates");

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
    "research/generate_pine_stub.py",
    "--rules-json", path.join(tempDir, "candidate-rules.json"),
    "--rules-output", path.join(tempDir, "strategy-rules.v1.json"),
    "--pine-output", path.join(tempDir, "strategy-soxl-soxs.pine")
  ]);
  assert(readFile("strategy-rules.v1.json").includes('"version": "strategy_rules.v1"'), "strategy rules JSON should be written");
  assert(readFile("strategy-soxl-soxs.pine").includes("strategy(\"EdgeLord SOXL/SOXS Candidate Scaffold\""), "Pine scaffold should be written");

  runNode(["scripts/validate-csv.mjs", "data/sample-bars.csv"]);
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
