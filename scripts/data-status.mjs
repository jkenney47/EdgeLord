#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const reportsDir = path.join(root, "reports");
const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4317";

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[-:.]/g, "");
}

function latestFile(dir, suffix) {
  if (!fs.existsSync(dir)) return null;
  const matches = fs.readdirSync(dir)
    .filter((name) => name.endsWith(suffix))
    .sort()
    .reverse();
  return matches[0] ? path.join(dir, matches[0]) : null;
}

function readJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function nextReadyLabelingTarget(plan) {
  if (!Array.isArray(plan)) return null;
  return plan.find((item) => item?.status === "ready" && Number(item?.remaining ?? 0) > 0) ?? null;
}

function normalizeAppTargetAction(action) {
  if (typeof action !== "string") return { action: "", staleDoctrine: false };
  const staleReplayPhrase = ["when", "the", "replay", "reaches"].join(" ");
  if (!new RegExp(staleReplayPhrase, "i").test(action)) return { action, staleDoctrine: false };
  return {
    action: action.replace(new RegExp(staleReplayPhrase, "i"), "when you reach"),
    staleDoctrine: true
  };
}

async function fetchJson(route) {
  const response = await fetch(`${apiBaseUrl}${route}`);
  if (!response.ok) {
    throw new Error(`${route} returned ${response.status}`);
  }
  return response.json();
}

const checks = [
  ["Data coverage", ["pnpm", "data:coverage"]],
  ["Label integrity", ["pnpm", "labels:integrity"]],
  ["Export backup", ["pnpm", "export:backup"]],
  ["Dataset report", ["pnpm", "research:report"]]
];

const startedAt = new Date();
const slug = timestampSlug(startedAt);
console.log("EdgeLord Data Status");
console.log("====================");
console.log(`started: ${startedAt.toISOString()}`);
console.log(`api: ${apiBaseUrl}`);

const failures = [];
const results = [];
for (const [name, command] of checks) {
  console.log("");
  console.log(`## ${name}`);
  const checkStartedAt = new Date();
  const result = spawnSync(command[0], command.slice(1), {
    stdio: "inherit",
    env: process.env,
    shell: false
  });
  const status = result.status ?? 1;
  results.push({
    name,
    command: command.join(" "),
    status,
    startedAt: checkStartedAt.toISOString(),
    finishedAt: new Date().toISOString()
  });

  if (status !== 0) {
    failures.push({ name, status });
  }
}

console.log("");
console.log("Summary");
const finishedAt = new Date();
const latestArtifacts = {
  dataCoverageJson: latestFile(reportsDir, "-data-coverage.json"),
  labelIntegrityMd: latestFile(reportsDir, "-label-integrity.md"),
  labelIntegrityJson: latestFile(reportsDir, "-label-integrity.json"),
  researchSummaryJson: latestFile(reportsDir, "-research-summary.json")
};
const dataCoverage = readJson(latestArtifacts.dataCoverageJson);
const labelIntegrity = readJson(latestArtifacts.labelIntegrityJson);
const researchSummary = readJson(latestArtifacts.researchSummaryJson);
const datasetPulse = failures.length === 0 ? await fetchJson("/state/dataset") : null;
const readiness = {
  dataCoverage: dataCoverage?.readiness ?? null,
  unresolvedTargetGap: dataCoverage?.readiness?.unresolvedTargetGap ?? null,
  labelIntegrity: labelIntegrity ? {
    labels: labelIntegrity.labels,
    readyForModeling: labelIntegrity.readyForModeling,
    issues: labelIntegrity.issues
  } : null,
  app: datasetPulse ? {
    nextTarget: datasetPulse.nextTarget ?? null,
    labels: datasetPulse.labels ?? null,
    trades: datasetPulse.trades ?? null,
    targets: datasetPulse.targets ?? null
  } : null,
  research: researchSummary ? {
    exportBackup: researchSummary.artifacts?.exportBackup ?? null,
    exportManifest: researchSummary.exportManifest ?? null,
    dataset: researchSummary.dataset ?? null,
    nextLabelingTarget: researchSummary.nextLabelingTarget ?? null,
    promotion: researchSummary.promotion ?? null,
    topHumanMimicRule: researchSummary.topHumanMimicRule ?? null,
    topExitRule: researchSummary.topExitRule ?? null,
    topReturnOptimizedRule: researchSummary.topReturnOptimizedRule ?? null
  } : null
};
const nextLabelingTarget = readiness.research?.nextLabelingTarget ?? nextReadyLabelingTarget(readiness.research?.dataset?.labelingPlan);
const summary = {
  version: "edgelord.data_status.v1",
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  apiBaseUrl,
  ok: failures.length === 0,
  results,
  failures,
  readiness,
  nextLabelingTarget,
  artifacts: Object.fromEntries(
    Object.entries(latestArtifacts).map(([key, value]) => [key, value ? path.relative(root, value) : null])
  )
};
fs.mkdirSync(reportsDir, { recursive: true });
const summaryPath = path.join(reportsDir, `${slug}-data-status.json`);
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
if (failures.length === 0) {
  console.log("- All data status checks completed.");
  if (readiness.dataCoverage) {
    console.log(`- Data coverage: ${readiness.dataCoverage.code} (${readiness.dataCoverage.readyForResearch ? "research-ready" : "not research-ready"})`);
  }
  if (readiness.unresolvedTargetGap) {
    const gap = readiness.unresolvedTargetGap;
    console.log(`- Unresolved target gap: ${gap.missingStart.slice(0, 10)} -> ${gap.missingEnd.slice(0, 10)} (${gap.gapYears.toFixed(1)} years)`);
  }
  if (readiness.labelIntegrity) {
    console.log(`- Label integrity: ${readiness.labelIntegrity.readyForModeling ? "ready" : "issues found"}`);
  }
  if (readiness.research?.dataset?.readiness) {
    const datasetReadiness = readiness.research.dataset.readiness;
    console.log(`- Rule mining: ${datasetReadiness.readyForRuleMining ? "ready" : "not ready"} (${datasetReadiness.entryRows} entries / ${datasetReadiness.skipRows} skips)`);
    console.log(`- Rough rule mining: ${datasetReadiness.readyForRoughRuleMining ? "ready" : "not ready"} (${datasetReadiness.decisionRows} decisions / ${datasetReadiness.targets?.roughRuleMiningDecisionRows ?? 300} target)`);
    console.log(`- Return analysis: ${datasetReadiness.readyForReturnAnalysis ? "ready" : "not ready"} (${datasetReadiness.closedTrades} eligible closed trades)`);
    console.log(`- Rough return analysis: ${datasetReadiness.readyForRoughReturnAnalysis ? "ready" : "not ready"} (${datasetReadiness.closedTrades} eligible closed trades / ${datasetReadiness.targets?.roughReturnAnalysisClosedTrades ?? 30} target)`);
    console.log(`- Exit rule mining: ${datasetReadiness.readyForExitRuleMining ? "ready" : "not ready"} (${datasetReadiness.tradeCandidateExitRows} exits / ${datasetReadiness.tradeCandidateHoldRows} holds)`);
  }
  if (readiness.research?.exportManifest?.tradeCandidates) {
    const tradeCandidates = readiness.research.exportManifest.tradeCandidates;
    console.log(`- Trade candidates export: ${tradeCandidates.rows} rows (${tradeCandidates.closedTradesWithCandidates}/${tradeCandidates.closedTrades} eligible closed trades covered)`);
  }
  if (readiness.research?.promotion) {
    const promotion = readiness.research.promotion;
    const warningCount = Array.isArray(promotion.warnings) ? promotion.warnings.length : 0;
    console.log(`- Pine promotion: ${promotion.status ?? "unknown"} (${warningCount} warnings)`);
  }
  if (readiness.app?.nextTarget) {
    const appTarget = readiness.app.nextTarget;
    const appAction = normalizeAppTargetAction(appTarget.action);
    console.log(`- App focus target: ${appTarget.kind} (${appTarget.current}/${appTarget.target}, ${appTarget.remaining} remaining)`);
    console.log(`  ${appAction.action}`);
    if (appAction.staleDoctrine) {
      console.log("  note: live API returned stale replay-only wording; restart the API to refresh app focus copy.");
    }
  }
  if (nextLabelingTarget) {
    console.log(`- Research labeling target: ${nextLabelingTarget.kind} (${nextLabelingTarget.current}/${nextLabelingTarget.target}, ${nextLabelingTarget.remaining} remaining)`);
    console.log(`  ${nextLabelingTarget.action}`);
  }
  console.log(`status: ${path.relative(root, summaryPath)}`);
  process.exit(0);
}

for (const failure of failures) {
  console.log(`- ${failure.name} failed with exit code ${failure.status}.`);
}
console.log(`status: ${path.relative(root, summaryPath)}`);
process.exit(1);
