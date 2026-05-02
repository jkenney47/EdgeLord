#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4317";
const reportsDir = path.join(root, "reports");
const writeReport = process.argv.includes("--write");
const repairLabels = process.argv.includes("--repair");
const priceTolerance = 0.0001;
const requiredTrainingFeatureKeys = [
  "close",
  "volume",
  "ema25",
  "sma100",
  "atr14",
  "stochRsiK",
  "stochRsiD",
  "closeAboveEma25",
  "closeAboveSma100",
  "distanceToEma25Pct",
  "distanceToSma100Pct",
  "recent5ReturnPct",
  "recent10ReturnPct",
  "recent20ReturnPct",
  "recent20High",
  "recent20Low",
  "closeRankRecent20",
  "pairedTicker",
  "pairedClose",
  "pairRatioClose",
  "d1Close",
  "d1CloseAboveEma25",
  "h4Close",
  "h4CloseAboveEma25",
  "h2Close",
  "h2CloseAboveEma25"
];

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[-:.]/g, "");
}

async function fetchJson(route) {
  const response = await fetch(`${baseUrl}${route}`);
  if (!response.ok) {
    throw new Error(`${route} returned ${response.status}. Start the API with pnpm dev or set API_BASE_URL.`);
  }
  return response.json();
}

async function patchJson(route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${route} returned ${response.status}: ${text}`);
  }
  return response.json();
}

const labels = (await fetchJson("/labels")).labels ?? [];
const barsByKey = new Map();

async function barsFor(ticker, timeframe) {
  const key = `${ticker}:${timeframe}`;
  if (!barsByKey.has(key)) {
    const params = new URLSearchParams({ ticker, timeframe });
    const bars = (await fetchJson(`/bars?${params.toString()}`)).bars ?? [];
    barsByKey.set(key, new Map(bars.map((bar) => [bar.timestamp, bar])));
  }
  return barsByKey.get(key);
}

const missingBars = [];
const priceMismatches = [];
const staleIndexes = [];
const trainingEligibilityMismatches = [];
const eligibleOrphanExits = [];
const sequenceIssues = [];
const sameCandleDecisionConflicts = [];
const featureSnapshotIssues = [];

function expectedTrainingEligible(label) {
  if (Number(label.potential_visual_leakage) === 1) return false;
  return label.label_source === "actual_trade" || (label.label_source === "retrospective_replay" && label.capture_mode === "replay");
}

function inspectSequence(items) {
  let open = null;
  for (const label of [...items].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    const isExcludedOrphanExit = label.action === "EXIT" &&
      Number(label.training_eligible) === 0 &&
      label.trade_id === null &&
      label.parent_entry_label_id === null;
    if (isExcludedOrphanExit) continue;

    if (label.action === "ENTRY") {
      if (open) {
        sequenceIssues.push({
          label,
          reason: `ENTRY while ${open.ticker} trade ${open.id} is still open`,
          openLabel: open
        });
      } else {
        open = label;
      }
    } else if (label.action === "EXIT") {
      if (!open) {
        sequenceIssues.push({ label, reason: "EXIT with no open trade", openLabel: null });
      } else if (open.ticker !== label.ticker) {
        sequenceIssues.push({
          label,
          reason: `EXIT ${label.ticker} while open trade is ${open.ticker}`,
          openLabel: open
        });
      } else {
        open = null;
      }
    }
  }
}

function parseFeatureSnapshot(label) {
  try {
    const parsed = JSON.parse(label.features_json || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, features: null, reason: "features_json is not an object" };
    }
    return { ok: true, features: parsed, reason: null };
  } catch (error) {
    return { ok: false, features: null, reason: `features_json is invalid JSON: ${error.message}` };
  }
}

function inspectSameCandleDecisionConflicts(items) {
  const byDecisionKey = new Map();
  for (const label of items) {
    const key = [
      label.label_source,
      label.ticker,
      label.timeframe,
      label.timestamp
    ].join("|");
    const group = byDecisionKey.get(key) ?? [];
    group.push(label);
    byDecisionKey.set(key, group);
  }

  for (const group of byDecisionKey.values()) {
    if (group.length <= 1) continue;
    sameCandleDecisionConflicts.push({
      labels: group,
      actions: Array.from(new Set(group.map((label) => label.action))).sort()
    });
  }
}

inspectSequence(labels);
inspectSameCandleDecisionConflicts(labels);

for (const label of labels) {
  const expectedEligible = expectedTrainingEligible(label);
  if (Number(label.training_eligible) !== (expectedEligible ? 1 : 0)) {
    trainingEligibilityMismatches.push({ label, expectedEligible });
  }
  if (
    label.action === "EXIT" &&
    Number(label.training_eligible) === 1 &&
    (!label.trade_id || !label.parent_entry_label_id)
  ) {
    eligibleOrphanExits.push(label);
  }

  const featureSnapshot = parseFeatureSnapshot(label);
  if (!featureSnapshot.ok) {
    featureSnapshotIssues.push({ label, reason: featureSnapshot.reason, missingKeys: [] });
  } else if (Number(label.training_eligible) === 1) {
    const missingKeys = requiredTrainingFeatureKeys.filter((featureKey) => !Object.prototype.hasOwnProperty.call(featureSnapshot.features, featureKey));
    if (missingKeys.length > 0) {
      featureSnapshotIssues.push({
        label,
        reason: "training-eligible label is missing required feature snapshot keys",
        missingKeys
      });
    }
  }

  const bars = await barsFor(label.ticker, label.timeframe);
  const bar = bars.get(label.timestamp);
  if (!bar) {
    missingBars.push(label);
    continue;
  }

  const priceDelta = Math.abs(Number(label.chart_price) - Number(bar.close));
  if (priceDelta > priceTolerance) {
    priceMismatches.push({ label, bar, priceDelta });
  }

  const timestamps = Array.from(bars.keys());
  const expectedIndex = timestamps.indexOf(label.timestamp);
  if (expectedIndex >= 0 && Number(label.bar_index) !== expectedIndex) {
    staleIndexes.push({ label, expectedIndex });
  }
}

if (repairLabels) {
  const repairable = new Map();
  for (const item of priceMismatches) {
    repairable.set(item.label.id, item);
  }
  for (const item of staleIndexes) {
    if (!repairable.has(item.label.id)) {
      const bars = await barsFor(item.label.ticker, item.label.timeframe);
      repairable.set(item.label.id, { label: item.label, bar: bars.get(item.label.timestamp) });
    }
  }
  for (const item of featureSnapshotIssues) {
    if (!repairable.has(item.label.id)) {
      const bars = await barsFor(item.label.ticker, item.label.timeframe);
      repairable.set(item.label.id, { label: item.label, bar: bars.get(item.label.timestamp) });
    }
  }

  for (const item of repairable.values()) {
    if (!item.bar) continue;
    await patchJson(`/labels/${item.label.id}`, {
      timestamp: item.label.timestamp,
      chartPrice: Number(item.bar.close)
    });
  }

  console.log(`repaired_labels: ${repairable.size}`);
  console.log("rerun `pnpm labels:integrity` or `pnpm data:status` to verify.");
  process.exit(0);
}

const lines = [
  "EdgeLord Label Integrity",
  "========================",
  `api: ${baseUrl}`,
  `labels: ${labels.length}`,
  `missing_bar_labels: ${missingBars.length}`,
  `chart_price_mismatches: ${priceMismatches.length}`,
  `stale_bar_indexes: ${staleIndexes.length}`,
  `training_eligibility_mismatches: ${trainingEligibilityMismatches.length}`,
  `eligible_orphan_exits: ${eligibleOrphanExits.length}`,
  `sequence_issues: ${sequenceIssues.length}`,
  `same_candle_decision_conflicts: ${sameCandleDecisionConflicts.length}`,
  `feature_snapshot_issues: ${featureSnapshotIssues.length}`,
  "",
  "Missing Bars"
];

if (missingBars.length === 0) {
  lines.push("- none");
} else {
  for (const label of missingBars.slice(0, 25)) {
    lines.push(`- ${label.id} ${label.action} ${label.ticker} ${label.timeframe} ${label.timestamp}`);
  }
}

lines.push("", "Chart Price Mismatches");
if (priceMismatches.length === 0) {
  lines.push("- none");
} else {
  for (const item of priceMismatches.slice(0, 25)) {
    lines.push(`- ${item.label.id} ${item.label.ticker} ${item.label.timeframe} ${item.label.timestamp}: label=${item.label.chart_price} bar_close=${item.bar.close}`);
  }
}

lines.push("", "Stale Bar Indexes");
if (staleIndexes.length === 0) {
  lines.push("- none");
} else {
  for (const item of staleIndexes.slice(0, 25)) {
    lines.push(`- ${item.label.id} ${item.label.ticker} ${item.label.timeframe} ${item.label.timestamp}: label=${item.label.bar_index} expected=${item.expectedIndex}`);
  }
}

lines.push("", "Training Eligibility Mismatches");
if (trainingEligibilityMismatches.length === 0) {
  lines.push("- none");
} else {
  for (const item of trainingEligibilityMismatches.slice(0, 25)) {
    lines.push(
      `- ${item.label.id} ${item.label.action} ${item.label.label_source} ${item.label.capture_mode} ` +
      `leakage=${item.label.potential_visual_leakage}: label=${item.label.training_eligible} expected=${item.expectedEligible ? 1 : 0}`
    );
  }
}

lines.push("", "Eligible Orphan Exits");
if (eligibleOrphanExits.length === 0) {
  lines.push("- none");
} else {
  for (const label of eligibleOrphanExits.slice(0, 25)) {
    lines.push(`- ${label.id} ${label.ticker} ${label.timeframe} ${label.timestamp}`);
  }
}

lines.push("", "State Machine Sequence Issues");
if (sequenceIssues.length === 0) {
  lines.push("- none");
} else {
  for (const item of sequenceIssues.slice(0, 25)) {
    lines.push(`- ${item.label.id} ${item.label.action} ${item.label.ticker} ${item.label.timeframe} ${item.label.timestamp}: ${item.reason}`);
  }
}

lines.push("", "Same-Candle Decision Conflicts");
if (sameCandleDecisionConflicts.length === 0) {
  lines.push("- none");
} else {
  for (const item of sameCandleDecisionConflicts.slice(0, 25)) {
    const first = item.labels[0];
    lines.push(
      `- ${first.label_source} ${first.ticker} ${first.timeframe} ${first.timestamp}: ` +
      `${item.labels.length} labels actions=${item.actions.join("|")} ids=${item.labels.map((label) => label.id).join("|")}`
    );
  }
}

lines.push("", "Feature Snapshot Issues");
if (featureSnapshotIssues.length === 0) {
  lines.push("- none");
} else {
  for (const item of featureSnapshotIssues.slice(0, 25)) {
    const missing = item.missingKeys.length > 0 ? ` missing=${item.missingKeys.join("|")}` : "";
    lines.push(`- ${item.label.id} ${item.label.action} ${item.label.ticker} ${item.label.timeframe} ${item.label.timestamp}: ${item.reason}${missing}`);
  }
}

lines.push("", "Readiness");
if (
  missingBars.length ||
  priceMismatches.length ||
  staleIndexes.length ||
  trainingEligibilityMismatches.length ||
  eligibleOrphanExits.length ||
  sequenceIssues.length ||
  sameCandleDecisionConflicts.length ||
  featureSnapshotIssues.length
) {
  lines.push("- Label integrity issues exist. Repair or re-label before modeling.");
} else {
  lines.push("- Labels match the current bar cache, training eligibility policy, and feature snapshot contract.");
}

const report = `${lines.join("\n")}\n`;
const summary = {
  version: "edgelord.label_integrity.v1",
  createdAt: new Date().toISOString(),
  apiBaseUrl: baseUrl,
  labels: labels.length,
  issues: {
    missingBarLabels: missingBars.length,
    chartPriceMismatches: priceMismatches.length,
    staleBarIndexes: staleIndexes.length,
    trainingEligibilityMismatches: trainingEligibilityMismatches.length,
    eligibleOrphanExits: eligibleOrphanExits.length,
    sequenceIssues: sequenceIssues.length,
    sameCandleDecisionConflicts: sameCandleDecisionConflicts.length,
    featureSnapshotIssues: featureSnapshotIssues.length
  },
  readyForModeling:
    missingBars.length === 0 &&
    priceMismatches.length === 0 &&
    staleIndexes.length === 0 &&
    trainingEligibilityMismatches.length === 0 &&
    eligibleOrphanExits.length === 0 &&
    sequenceIssues.length === 0 &&
    sameCandleDecisionConflicts.length === 0 &&
    featureSnapshotIssues.length === 0,
  samples: {
    missingBars: missingBars.slice(0, 25).map((label) => ({
      id: label.id,
      action: label.action,
      ticker: label.ticker,
      timeframe: label.timeframe,
      timestamp: label.timestamp
    })),
    chartPriceMismatches: priceMismatches.slice(0, 25).map((item) => ({
      id: item.label.id,
      ticker: item.label.ticker,
      timeframe: item.label.timeframe,
      timestamp: item.label.timestamp,
      labelPrice: Number(item.label.chart_price),
      barClose: Number(item.bar.close),
      priceDelta: item.priceDelta
    })),
    staleBarIndexes: staleIndexes.slice(0, 25).map((item) => ({
      id: item.label.id,
      ticker: item.label.ticker,
      timeframe: item.label.timeframe,
      timestamp: item.label.timestamp,
      labelBarIndex: Number(item.label.bar_index),
      expectedBarIndex: item.expectedIndex
    })),
    trainingEligibilityMismatches: trainingEligibilityMismatches.slice(0, 25).map((item) => ({
      id: item.label.id,
      action: item.label.action,
      labelSource: item.label.label_source,
      captureMode: item.label.capture_mode,
      potentialVisualLeakage: Number(item.label.potential_visual_leakage),
      labelTrainingEligible: Number(item.label.training_eligible),
      expectedTrainingEligible: item.expectedEligible ? 1 : 0
    })),
    eligibleOrphanExits: eligibleOrphanExits.slice(0, 25).map((label) => ({
      id: label.id,
      ticker: label.ticker,
      timeframe: label.timeframe,
      timestamp: label.timestamp
    })),
    sequenceIssues: sequenceIssues.slice(0, 25).map((item) => ({
      id: item.label.id,
      action: item.label.action,
      ticker: item.label.ticker,
      timeframe: item.label.timeframe,
      timestamp: item.label.timestamp,
      reason: item.reason,
      openLabelId: item.openLabel?.id ?? null,
      openTicker: item.openLabel?.ticker ?? null
    })),
    sameCandleDecisionConflicts: sameCandleDecisionConflicts.slice(0, 25).map((item) => ({
      labelSource: item.labels[0]?.label_source ?? null,
      ticker: item.labels[0]?.ticker ?? null,
      timeframe: item.labels[0]?.timeframe ?? null,
      timestamp: item.labels[0]?.timestamp ?? null,
      actions: item.actions,
      labelIds: item.labels.map((label) => label.id)
    })),
    featureSnapshotIssues: featureSnapshotIssues.slice(0, 25).map((item) => ({
      id: item.label.id,
      action: item.label.action,
      ticker: item.label.ticker,
      timeframe: item.label.timeframe,
      timestamp: item.label.timestamp,
      reason: item.reason,
      missingKeys: item.missingKeys
    }))
  }
};

process.stdout.write(report);

if (writeReport) {
  fs.mkdirSync(reportsDir, { recursive: true });
  const slug = timestampSlug();
  const reportPath = path.join(reportsDir, `${slug}-label-integrity.md`);
  const jsonPath = path.join(reportsDir, `${slug}-label-integrity.json`);
  fs.writeFileSync(reportPath, report);
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`report: ${path.relative(root, reportPath)}`);
  console.log(`json: ${path.relative(root, jsonPath)}`);
}
