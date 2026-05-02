#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const reportsDir = path.join(root, "reports");

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
console.log(`api: ${process.env.API_BASE_URL ?? "http://127.0.0.1:4317"}`);

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
const readiness = {
  dataCoverage: dataCoverage?.readiness ?? null,
  labelIntegrity: labelIntegrity ? {
    labels: labelIntegrity.labels,
    readyForModeling: labelIntegrity.readyForModeling,
    issues: labelIntegrity.issues
  } : null,
  research: researchSummary ? {
    exportBackup: researchSummary.artifacts?.exportBackup ?? null,
    dataset: researchSummary.dataset ?? null,
    topHumanMimicRule: researchSummary.topHumanMimicRule ?? null,
    topReturnOptimizedRule: researchSummary.topReturnOptimizedRule ?? null
  } : null
};
const summary = {
  version: "edgelord.data_status.v1",
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  apiBaseUrl: process.env.API_BASE_URL ?? "http://127.0.0.1:4317",
  ok: failures.length === 0,
  results,
  failures,
  readiness,
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
  if (readiness.labelIntegrity) {
    console.log(`- Label integrity: ${readiness.labelIntegrity.readyForModeling ? "ready" : "issues found"}`);
  }
  if (readiness.research?.dataset?.readiness) {
    const datasetReadiness = readiness.research.dataset.readiness;
    console.log(`- Rule mining: ${datasetReadiness.readyForRuleMining ? "ready" : "not ready"} (${datasetReadiness.entryRows} entries / ${datasetReadiness.skipRows} skips)`);
    console.log(`- Return analysis: ${datasetReadiness.readyForReturnAnalysis ? "ready" : "not ready"} (${datasetReadiness.closedTrades} closed trades)`);
  }
  console.log(`status: ${path.relative(root, summaryPath)}`);
  process.exit(0);
}

for (const failure of failures) {
  console.log(`- ${failure.name} failed with exit code ${failure.status}.`);
}
console.log(`status: ${path.relative(root, summaryPath)}`);
process.exit(1);
