import type { BarSummaryRow } from "./bars";
import type { Label, Trade } from "./schema";

const targets = {
  decisions: 300,
  entries: 100,
  skips: 100,
  closedTrades: 30
} as const;

export type DatasetPulse = ReturnType<typeof buildDatasetPulse>;

export function buildDatasetPulse(barSummary: BarSummaryRow[], labels: Label[], trades: Trade[]) {
  const activeLabels = labels.filter((label) => label.deleted_at === null);
  const trainingLabels = activeLabels.filter((label) => label.training_eligible === 1);
  const openTrade = trades.find((trade) => trade.status === "open") ?? null;
  const closedTrades = trades.filter((trade) => trade.status === "closed");
  const trainingEntries = trainingLabels.filter((label) => label.action === "ENTRY").length;
  const trainingExits = trainingLabels.filter((label) => label.action === "EXIT").length;
  const trainingSkips = trainingLabels.filter((label) => label.action === "SKIP").length;
  const dataReadiness = summarizeDataReadiness(barSummary);
  const integrity = summarizeLabelIntegrity(activeLabels);
  const exitTarget = Math.max(trainingEntries, 1);
  const targetProgress = [
    { key: "decisions", label: "Decisions", current: trainingLabels.length, target: targets.decisions },
    { key: "entries", label: "Entries", current: trainingEntries, target: targets.entries },
    { key: "exits", label: "Exits", current: trainingExits, target: exitTarget },
    { key: "skips", label: "Skips", current: trainingSkips, target: targets.skips },
    { key: "closedTrades", label: "Closed", current: closedTrades.length, target: targets.closedTrades }
  ].map((item) => ({ ...item, complete: item.current >= item.target }));
  const nextTarget = nextLabelingTarget({
    dataReady: dataReadiness.code === "ready",
    integrityIssueCount: integrity.issueCount,
    openTrade,
    decisions: trainingLabels.length,
    entries: trainingEntries,
    exits: trainingExits,
    skips: trainingSkips,
    closedTrades: closedTrades.length
  });

  return {
    version: "edgelord.dataset_pulse.v1",
    dataReadiness,
    integrity,
    labels: {
      total: activeLabels.length,
      trainingEligible: trainingLabels.length,
      excluded: activeLabels.length - trainingLabels.length,
      actions: countBy(activeLabels, "action"),
      trainingActions: countBy(trainingLabels, "action")
    },
    trades: {
      total: trades.length,
      open: openTrade ? 1 : 0,
      closed: closedTrades.length,
      status: countBy(trades, "status"),
      openTrade: openTrade ? {
        id: openTrade.id,
        ticker: openTrade.ticker,
        entryTimestamp: openTrade.entry_timestamp,
        entryPrice: openTrade.entry_price
      } : null
    },
    targets: targetProgress,
    nextTarget,
    nextActions: [nextTarget.action]
  };
}

function summarizeDataReadiness(barSummary: BarSummaryRow[]) {
  const rawRows = barSummary.filter((row) => row.timeframe === "RAW");
  const chartRows = barSummary.filter((row) => row.timeframe !== "RAW");
  const rawSources = new Set(rawRows.map((row) => row.source));
  const chartCombos = new Set(chartRows.map((row) => `${row.ticker}:${row.timeframe}`));
  const spans = chartRows
    .filter((row) => row.first && row.last)
    .map((row) => (new Date(row.last as string).getTime() - new Date(row.first as string).getTime()) / 86_400_000);
  const shortestSpanDays = spans.length ? Math.min(...spans) : 0;

  if (chartCombos.size < 6) return readiness("missing_bars", "warn", "Data incomplete", shortestSpanDays);
  if (rawSources.size === 1 && rawSources.has("sample")) return readiness("sample_only", "warn", "Sample data only", shortestSpanDays);
  if (rawSources.has("sample") && rawSources.has("csv")) return readiness("mixed_sample_csv", "warn", "Mixed sample/csv data", shortestSpanDays);
  if (rawSources.size === 0) return readiness("aggregate_only", "warn", "Chart cache only", shortestSpanDays);
  if (shortestSpanDays < 365) return readiness("too_short", "warn", `Short data ${shortestSpanDays.toFixed(0)}d`, shortestSpanDays);
  if (shortestSpanDays < 365 * 5) return readiness("early", "warn", `Early data ${Math.floor(shortestSpanDays / 365)}y`, shortestSpanDays);
  return readiness("ready", "good", `Data ${Math.floor(shortestSpanDays / 365)}y`, shortestSpanDays);
}

function readiness(code: string, tone: "good" | "warn", text: string, shortestSpanDays: number) {
  return {
    code,
    tone,
    text,
    shortestSpanDays: Number(shortestSpanDays.toFixed(1))
  };
}

function nextLabelingTarget(input: {
  dataReady: boolean;
  integrityIssueCount: number;
  openTrade: Trade | null;
  decisions: number;
  entries: number;
  exits: number;
  skips: number;
  closedTrades: number;
}) {
  if (!input.dataReady) {
    return target("data_ready", "Import adjusted SOXL/SOXS data before serious labeling.", 0, 1);
  }
  if (input.integrityIssueCount > 0) {
    return target("fix_integrity", "Fix label integrity issues before adding modeling labels.", 0, input.integrityIssueCount);
  }
  if (input.openTrade) {
    return target("exit_coverage", `Close or continue the open ${input.openTrade.ticker} trade when the replay reaches your exit.`, input.exits, Math.max(input.entries, 1));
  }
  if (input.exits < input.entries) {
    return target("exit_coverage", "Add EXIT labels for completed trade ideas.", input.exits, Math.max(input.entries, 1));
  }
  const immediateSkipTarget = Math.min(Math.max(input.entries, 1), targets.skips);
  if (input.skips < immediateSkipTarget) {
    return target("skip_coverage", "Add SKIP labels near tempting setups so the model has negative examples.", input.skips, immediateSkipTarget);
  }
  if (input.closedTrades < targets.closedTrades) {
    return target("closed_trade_coverage", "Build more closed trades for return analysis.", input.closedTrades, targets.closedTrades);
  }
  if (input.decisions < targets.decisions) {
    return target("decision_coverage", "Keep labeling replay-safe decisions toward the rough mining target.", input.decisions, targets.decisions);
  }
  return target("rule_review_ready", "Dataset is ready for first-pass rule review.", input.decisions, targets.decisions);
}

function summarizeLabelIntegrity(labels: Label[]) {
  const eligibleOrphanExits = labels.filter((label) =>
    label.action === "EXIT" &&
    label.training_eligible === 1 &&
    (!label.trade_id || !label.parent_entry_label_id)
  );
  const entriesWithoutTrade = labels.filter((label) => label.action === "ENTRY" && !label.trade_id);
  const sameCandleDecisionConflicts = countSameCandleDecisionConflicts(labels);
  const issueCount = eligibleOrphanExits.length + entriesWithoutTrade.length + sameCandleDecisionConflicts;

  return {
    issueCount,
    eligibleOrphanExits: eligibleOrphanExits.length,
    entriesWithoutTrade: entriesWithoutTrade.length,
    sameCandleDecisionConflicts,
    ready: issueCount === 0
  };
}

function countSameCandleDecisionConflicts(labels: Label[]): number {
  const counts = new Map<string, number>();
  for (const label of labels) {
    const key = [
      label.label_source,
      label.ticker,
      label.timeframe,
      label.timestamp
    ].join("|");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].filter((count) => count > 1).length;
}

function target(kind: string, action: string, current: number, targetValue: number) {
  return {
    kind,
    action,
    current,
    target: targetValue,
    remaining: Math.max(0, targetValue - current)
  };
}

function countBy<T>(rows: T[], key: keyof T): Record<string, number> {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const value = String(row[key] ?? "(blank)");
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
