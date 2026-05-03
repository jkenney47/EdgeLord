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
const trades = (await fetchJson("/trades")).trades ?? [];
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
const tradeConsistencyIssues = [];

function expectedTrainingEligible(label) {
  return ["actual_trade", "retrospective_replay", "retrospective_hindsight"].includes(label.label_source);
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
    } else if (label.action === "SKIP" && open && Number(label.training_eligible) === 1) {
      sequenceIssues.push({
        label,
        reason: `SKIP while ${open.ticker} trade ${open.id} is still open`,
        openLabel: open
      });
    } else if (label.action === "EXIT") {
      if (!open) {
        sequenceIssues.push({ label, reason: "EXIT with no open trade", openLabel: null });
      } else if (open.ticker !== label.ticker) {
        sequenceIssues.push({
          label,
          reason: `EXIT ${label.ticker} while open trade is ${open.ticker}`,
          openLabel: open
        });
      } else if (String(label.timestamp) < String(open.timestamp)) {
        sequenceIssues.push({
          label,
          reason: `EXIT before entry label ${open.id}`,
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

function decisionPrice(label) {
  return label.execution_price ?? label.chart_price;
}

function isCloseEnough(left, right) {
  return Math.abs(Number(left) - Number(right)) <= priceTolerance;
}

function inspectTradeConsistency(items, tradeRows) {
  const labelsById = new Map(items.map((label) => [label.id, label]));
  const tradesById = new Map(tradeRows.map((trade) => [trade.id, trade]));
  const openTrades = tradeRows.filter((trade) => trade.status === "open");

  if (openTrades.length > 1) {
    tradeConsistencyIssues.push({
      trade: null,
      label: null,
      reason: `More than one open trade exists: ${openTrades.map((trade) => trade.id).join(", ")}`
    });
  }

  for (const label of items) {
    if (label.action === "ENTRY" && !label.trade_id) {
      tradeConsistencyIssues.push({ trade: null, label, reason: "ENTRY label is missing trade_id" });
    }
    if (label.action === "ENTRY" && label.trade_id && !tradesById.has(label.trade_id)) {
      tradeConsistencyIssues.push({ trade: null, label, reason: `ENTRY label references missing trade ${label.trade_id}` });
    }
    if (label.action === "EXIT" && label.trade_id && !tradesById.has(label.trade_id)) {
      tradeConsistencyIssues.push({ trade: null, label, reason: `EXIT label references missing trade ${label.trade_id}` });
    }
    if ((label.action === "SKIP" || label.action === "INVALID") && (label.trade_id || label.parent_entry_label_id)) {
      tradeConsistencyIssues.push({ trade: null, label, reason: `${label.action} label should not have trade linkage` });
    }
  }

  for (const trade of tradeRows) {
    const entry = labelsById.get(trade.entry_label_id);
    if (!entry) {
      tradeConsistencyIssues.push({ trade, label: null, reason: `Trade entry label ${trade.entry_label_id} is missing` });
      continue;
    }
    if (entry.action !== "ENTRY") {
      tradeConsistencyIssues.push({ trade, label: entry, reason: `Trade entry label ${entry.id} has action ${entry.action}` });
    }
    if (entry.trade_id !== trade.id) {
      tradeConsistencyIssues.push({ trade, label: entry, reason: `Entry label trade_id ${entry.trade_id} does not match trade ${trade.id}` });
    }
    if (entry.ticker !== trade.ticker) {
      tradeConsistencyIssues.push({ trade, label: entry, reason: `Trade ticker ${trade.ticker} does not match entry label ticker ${entry.ticker}` });
    }
    if (entry.timestamp !== trade.entry_timestamp) {
      tradeConsistencyIssues.push({ trade, label: entry, reason: `Trade entry timestamp ${trade.entry_timestamp} does not match entry label ${entry.timestamp}` });
    }
    if (!isCloseEnough(trade.entry_price, decisionPrice(entry))) {
      tradeConsistencyIssues.push({ trade, label: entry, reason: `Trade entry price ${trade.entry_price} does not match entry decision price ${decisionPrice(entry)}` });
    }

    if (trade.status === "open") {
      if (trade.exit_label_id || trade.exit_timestamp || trade.exit_price !== null || trade.return_pct !== null) {
        tradeConsistencyIssues.push({ trade, label: entry, reason: "Open trade has exit fields populated" });
      }
      continue;
    }

    if (trade.status !== "closed" && trade.status !== "invalid") {
      tradeConsistencyIssues.push({ trade, label: entry, reason: `Trade has unknown status ${trade.status}` });
    }

    if (trade.status === "closed") {
      if (!trade.exit_label_id) {
        tradeConsistencyIssues.push({ trade, label: entry, reason: "Closed trade is missing exit_label_id" });
        continue;
      }
      const exit = labelsById.get(trade.exit_label_id);
      if (!exit) {
        tradeConsistencyIssues.push({ trade, label: null, reason: `Trade exit label ${trade.exit_label_id} is missing` });
        continue;
      }
      if (exit.action !== "EXIT") {
        tradeConsistencyIssues.push({ trade, label: exit, reason: `Trade exit label ${exit.id} has action ${exit.action}` });
      }
      if (exit.trade_id !== trade.id) {
        tradeConsistencyIssues.push({ trade, label: exit, reason: `Exit label trade_id ${exit.trade_id} does not match trade ${trade.id}` });
      }
      if (exit.parent_entry_label_id !== entry.id) {
        tradeConsistencyIssues.push({ trade, label: exit, reason: `Exit parent ${exit.parent_entry_label_id} does not match entry ${entry.id}` });
      }
      if (exit.ticker !== trade.ticker) {
        tradeConsistencyIssues.push({ trade, label: exit, reason: `Trade ticker ${trade.ticker} does not match exit label ticker ${exit.ticker}` });
      }
      if (exit.timestamp !== trade.exit_timestamp) {
        tradeConsistencyIssues.push({ trade, label: exit, reason: `Trade exit timestamp ${trade.exit_timestamp} does not match exit label ${exit.timestamp}` });
      }
      if (!isCloseEnough(trade.exit_price, decisionPrice(exit))) {
        tradeConsistencyIssues.push({ trade, label: exit, reason: `Trade exit price ${trade.exit_price} does not match exit decision price ${decisionPrice(exit)}` });
      }
      const expectedReturn = ((Number(trade.exit_price) - Number(trade.entry_price)) / Number(trade.entry_price)) * 100;
      if (!isCloseEnough(trade.return_pct, expectedReturn)) {
        tradeConsistencyIssues.push({ trade, label: exit, reason: `Trade return_pct ${trade.return_pct} does not match expected ${expectedReturn}` });
      }
    }
  }
}

inspectTradeConsistency(labels, trades);

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
  `trade_consistency_issues: ${tradeConsistencyIssues.length}`,
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

lines.push("", "Trade Consistency Issues");
if (tradeConsistencyIssues.length === 0) {
  lines.push("- none");
} else {
  for (const item of tradeConsistencyIssues.slice(0, 25)) {
    const owner = item.trade
      ? `trade ${item.trade.id}`
      : item.label
        ? `label ${item.label.id}`
        : "dataset";
    lines.push(`- ${owner}: ${item.reason}`);
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
  featureSnapshotIssues.length ||
  tradeConsistencyIssues.length
) {
  lines.push("- Label integrity issues exist. Repair or re-label before modeling.");
} else {
  lines.push("- Labels and trades match the current bar cache, training eligibility policy, and feature snapshot contract.");
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
    featureSnapshotIssues: featureSnapshotIssues.length,
    tradeConsistencyIssues: tradeConsistencyIssues.length
  },
  readyForModeling:
    missingBars.length === 0 &&
    priceMismatches.length === 0 &&
    staleIndexes.length === 0 &&
    trainingEligibilityMismatches.length === 0 &&
    eligibleOrphanExits.length === 0 &&
    sequenceIssues.length === 0 &&
    sameCandleDecisionConflicts.length === 0 &&
    featureSnapshotIssues.length === 0 &&
    tradeConsistencyIssues.length === 0,
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
    })),
    tradeConsistencyIssues: tradeConsistencyIssues.slice(0, 25).map((item) => ({
      tradeId: item.trade?.id ?? null,
      labelId: item.label?.id ?? null,
      reason: item.reason
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
