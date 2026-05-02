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
  const targetProgress = [
    { key: "decisions", label: "Decisions", current: trainingLabels.length, target: targets.decisions },
    { key: "entries", label: "Entries", current: trainingEntries, target: targets.entries },
    { key: "skips", label: "Skips", current: trainingSkips, target: targets.skips },
    { key: "closedTrades", label: "Closed", current: closedTrades.length, target: targets.closedTrades }
  ].map((item) => ({ ...item, complete: item.current >= item.target }));

  return {
    version: "edgelord.dataset_pulse.v1",
    dataReadiness,
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
    nextActions: nextLabelingActions({
      dataReady: dataReadiness.code === "ready",
      openTrade,
      decisions: trainingLabels.length,
      entries: trainingEntries,
      exits: trainingExits,
      skips: trainingSkips,
      closedTrades: closedTrades.length
    })
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

function nextLabelingActions(input: {
  dataReady: boolean;
  openTrade: Trade | null;
  decisions: number;
  entries: number;
  exits: number;
  skips: number;
  closedTrades: number;
}): string[] {
  if (!input.dataReady) return ["Import adjusted SOXL/SOXS data before serious labeling."];
  if (input.openTrade) return [`Close or continue the open ${input.openTrade.ticker} trade when the replay reaches your exit.`];
  if (input.skips < Math.min(input.entries, targets.skips)) return ["Add SKIP labels near tempting setups so the model has negative examples."];
  if (input.exits < input.entries) return ["Add EXIT labels for completed trade ideas."];
  if (input.closedTrades < targets.closedTrades) return ["Build more closed trades for return analysis."];
  if (input.decisions < targets.decisions) return ["Keep labeling replay-safe decisions toward the rough mining target."];
  return ["Dataset is ready for first-pass rule review."];
}

function countBy<T>(rows: T[], key: keyof T): Record<string, number> {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const value = String(row[key] ?? "(blank)");
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
