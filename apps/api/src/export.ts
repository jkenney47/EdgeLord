import { getBars } from "./bars";
import { buildFeatures } from "./indicators";
import type { Label, Trade } from "./schema";
import pineFeatureMap from "../../../research/pine_feature_map.json" with { type: "json" };

type FeatureType = "number" | "string" | "boolean";

type FeatureDefinition = {
  featureKey: string;
  column: string;
  type: FeatureType;
  description: string;
};

const baseFeatureDefinitions = [
  { featureKey: "close", columnSuffix: "close", type: "number", description: "candle close." },
  { featureKey: "volume", columnSuffix: "volume", type: "number", description: "candle volume." },
  { featureKey: "ema25", columnSuffix: "ema25", type: "number", description: "EMA 25 using bars through the selected candle." },
  { featureKey: "sma100", columnSuffix: "sma100", type: "number", description: "SMA 100 using bars through the selected candle." },
  { featureKey: "atr14", columnSuffix: "atr14", type: "number", description: "ATR 14 using bars through the selected candle." },
  { featureKey: "stochRsiK", columnSuffix: "stoch_rsi_k", type: "number", description: "Stoch RSI K using RSI source SMIO, K=7, D=10, RSI length=14, stochastic length=15." },
  { featureKey: "stochRsiD", columnSuffix: "stoch_rsi_d", type: "number", description: "Stoch RSI D using RSI source SMIO, K=7, D=10, RSI length=14, stochastic length=15." },
  { featureKey: "closeAboveEma25", columnSuffix: "close_above_ema25", type: "boolean", description: "whether close is above EMA 25." },
  { featureKey: "closeAboveSma100", columnSuffix: "close_above_sma100", type: "boolean", description: "whether close is above SMA 100." },
  { featureKey: "distanceToEma25Pct", columnSuffix: "distance_to_ema25_pct", type: "number", description: "percent distance from close to EMA 25." },
  { featureKey: "distanceToSma100Pct", columnSuffix: "distance_to_sma100_pct", type: "number", description: "percent distance from close to SMA 100." },
  { featureKey: "recent5ReturnPct", columnSuffix: "recent_5_return_pct", type: "number", description: "percent return over the prior 5 bars." },
  { featureKey: "recent10ReturnPct", columnSuffix: "recent_10_return_pct", type: "number", description: "percent return over the prior 10 bars." },
  { featureKey: "recent20ReturnPct", columnSuffix: "recent_20_return_pct", type: "number", description: "percent return over the prior 20 bars." },
  { featureKey: "recent20High", columnSuffix: "recent_20_high", type: "number", description: "highest high over the prior 20 bars including the selected candle." },
  { featureKey: "recent20Low", columnSuffix: "recent_20_low", type: "number", description: "lowest low over the prior 20 bars including the selected candle." },
  { featureKey: "closeRankRecent20", columnSuffix: "close_rank_recent_20", type: "number", description: "close position within the recent 20-bar high/low range." },
  { featureKey: "wvf", columnSuffix: "wvf", type: "number", description: "CM_WVF_V3_Ult Williams Vix Fix value using pd=22." },
  { featureKey: "wvfMidLine", columnSuffix: "wvf_midline", type: "number", description: "CM_WVF_V3_Ult Bollinger midline using bbl=20." },
  { featureKey: "wvfUpperBand", columnSuffix: "wvf_upper_band", type: "number", description: "CM_WVF_V3_Ult upper band using bbl=20 and mult=2." },
  { featureKey: "wvfRangeHigh", columnSuffix: "wvf_range_high", type: "number", description: "CM_WVF_V3_Ult percentile range high using lb=50 and ph=0.85." },
  { featureKey: "wvfIsExtreme", columnSuffix: "wvf_is_extreme", type: "boolean", description: "CM_WVF_V3_Ult alert1: WVF is above upper band or range high." },
  { featureKey: "wvfWasExtremeNowFalse", columnSuffix: "wvf_was_extreme_now_false", type: "boolean", description: "CM_WVF_V3_Ult alert2: WVF was extreme on the prior bar and is no longer extreme." },
  { featureKey: "wvfFilteredEntry", columnSuffix: "wvf_filtered_entry", type: "boolean", description: "CM_WVF_V3_Ult alert3 filtered entry using ltLB=40, mtLB=14, str=3." },
  { featureKey: "wvfAggressiveFilteredEntry", columnSuffix: "wvf_aggressive_filtered_entry", type: "boolean", description: "CM_WVF_V3_Ult alert4 aggressive filtered entry using ltLB=40, mtLB=14, str=3." },
  { featureKey: "smioSmi", columnSuffix: "smio_smi", type: "number", description: "SMIO ergodic SMI from ta.tsi(close, short=20, long=20)." },
  { featureKey: "smioSignal", columnSuffix: "smio_signal", type: "number", description: "SMIO signal line EMA using length 10." },
  { featureKey: "smioOscillator", columnSuffix: "smio_oscillator", type: "number", description: "SMIO oscillator: SMI minus signal." },
  { featureKey: "vwap", columnSuffix: "vwap", type: "number", description: "monthly anchored VWAP using hlc3 source." },
  { featureKey: "vwapUpperBand1", columnSuffix: "vwap_upper_band_1", type: "number", description: "monthly anchored VWAP upper band #1 using standard deviation mode and multiplier 1." },
  { featureKey: "vwapLowerBand1", columnSuffix: "vwap_lower_band_1", type: "number", description: "monthly anchored VWAP lower band #1 using standard deviation mode and multiplier 1." },
  { featureKey: "distanceToVwapPct", columnSuffix: "distance_to_vwap_pct", type: "number", description: "percent distance from close to monthly anchored VWAP." },
  { featureKey: "pairedTicker", columnSuffix: "paired_ticker", type: "string", description: "opposite ETF ticker for paired context." },
  { featureKey: "pairedClose", columnSuffix: "paired_close", type: "number", description: "opposite ETF close at or before the selected timestamp when available." },
  { featureKey: "pairRatioClose", columnSuffix: "pair_ratio_close", type: "number", description: "ticker close divided by paired ticker close." }
] as const;

const timeframeFeaturePrefixes = [
  { featurePrefix: "d1", columnPrefix: "d1", label: "1D" },
  { featurePrefix: "h4", columnPrefix: "h4", label: "4H" },
  { featurePrefix: "h2", columnPrefix: "h2", label: "2H" }
] as const;

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

const selectedFeatureDefinitions: FeatureDefinition[] = baseFeatureDefinitions.map((definition) => ({
  featureKey: definition.featureKey,
  column: `feature_${definition.columnSuffix}`,
  type: definition.type,
  description: `Selected timeframe ${definition.description}`
}));

const multiTimeframeFeatureDefinitions: FeatureDefinition[] = timeframeFeaturePrefixes.flatMap((prefix) =>
  baseFeatureDefinitions.map((definition) => ({
    featureKey: `${prefix.featurePrefix}${capitalize(definition.featureKey)}`,
    column: `feature_${prefix.columnPrefix}_${definition.columnSuffix}`,
    type: definition.type,
    description: `${prefix.label} ${definition.description}`
  }))
);

const featureCatalog: FeatureDefinition[] = [
  ...selectedFeatureDefinitions,
  ...multiTimeframeFeatureDefinitions
];

export const featureColumns: Array<[string, string]> = featureCatalog.map(({ featureKey, column }) => [featureKey, column]);

const pineFeatureExpressions = pineFeatureMap.expressions as Record<string, string>;
const pineSupportedColumns = new Set(Object.keys(pineFeatureExpressions));

const labelsCsvColumns = [
  "id", "label_source", "training_eligible", "action", "ticker", "timeframe", "timestamp", "bar_index", "chart_price",
  "execution_price", "trade_id", "parent_entry_label_id", "capture_mode", "visible_until_timestamp",
  "potential_visual_leakage", "confidence", "setup_quality", "reason_codes", "notes", "created_at"
];

const tradesCsvColumns = [
  "trade_id", "ticker", "status", "entry_label_id", "exit_label_id", "entry_timestamp", "exit_timestamp", "entry_price", "exit_price", "return_pct"
];

const trainingFeaturesCsvColumns = [
  "label_id", "label_source", "capture_mode", "action", "target_entry", "target_exit", "target_skip", "target_invalid",
  "ticker", "timeframe", "timestamp", "trade_id", "parent_entry_label_id", "chart_price", "execution_price", "decision_price",
  "visible_until_timestamp",
  ...featureColumns.map(([, column]) => column)
];

const tradeCandidatesCsvColumns = [
  "candidate_id", "trade_id", "entry_label_id", "exit_label_id", "action", "target_exit", "target_hold",
  "ticker", "timeframe", "timestamp", "bar_index", "in_trade_bar_index", "chart_price",
  "entry_timestamp", "exit_timestamp", "entry_price", "exit_price", "return_pct",
  ...featureColumns.map(([, column]) => column)
];

const exportTrainingPolicy = {
  eligibleWhen: [
    "label_source is actual_trade",
    "label_source is retrospective_replay",
    "label_source is retrospective_hindsight"
  ],
  excludedByDefault: [
    "orphan EXIT labels"
  ],
  stateMachine: [
    "ENTRY opens a long SOXL/SOXS trade only while flat",
    "EXIT closes the currently open trade for the same ticker",
    "SKIP is a flat-state negative example only",
    "In-trade non-exit bars are exported as HOLD candidates in trade-candidates.csv after a trade is closed"
  ]
} as const;

function csvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvValue(row[column])).join(","))].join("\n");
}

export function labelsCsv(labels: Label[]): string {
  return toCsv(labels.map((label) => ({ ...label, reason_codes: label.reason_codes_json })), labelsCsvColumns);
}

export function tradesCsv(trades: Trade[]): string {
  return toCsv(trades.map((trade) => ({ ...trade, trade_id: trade.id })), tradesCsvColumns);
}

export function trainingFeaturesCsv(labels: Label[]): string {
  const rows = labels.filter((label) => label.training_eligible === 1).map((label) => {
    const features = JSON.parse(label.features_json || "{}") as Record<string, unknown>;
    return {
      label_id: label.id,
      label_source: label.label_source,
      capture_mode: label.capture_mode,
      action: label.action,
      target_entry: label.action === "ENTRY" ? 1 : 0,
      target_exit: label.action === "EXIT" ? 1 : 0,
      target_skip: label.action === "SKIP" ? 1 : 0,
      target_invalid: label.action === "INVALID" ? 1 : 0,
      ticker: label.ticker,
      timeframe: label.timeframe,
      timestamp: label.timestamp,
      trade_id: label.trade_id,
      parent_entry_label_id: label.parent_entry_label_id,
      chart_price: label.chart_price,
      execution_price: label.execution_price,
      decision_price: label.execution_price ?? label.chart_price,
      visible_until_timestamp: label.visible_until_timestamp,
      ...Object.fromEntries(featureColumns.map(([featureKey, column]) => [
        column,
        features[featureKey]
      ]))
    };
  });
  return toCsv(rows, trainingFeaturesCsvColumns);
}

function buildTradeCandidateRows(labels: Label[], trades: Trade[]): Array<Record<string, unknown>> {
  const labelById = new Map(labels.filter((label) => label.deleted_at === null).map((label) => [label.id, label]));
  const rows: Array<Record<string, unknown>> = [];

  for (const trade of trades.filter((item) => item.status === "closed" && item.exit_label_id)) {
    const entry = labelById.get(trade.entry_label_id);
    const exit = trade.exit_label_id ? labelById.get(trade.exit_label_id) : null;
    if (!entry || !exit || entry.training_eligible !== 1 || exit.training_eligible !== 1) continue;

    const bars = getBars(entry.ticker, entry.timeframe);
    const entryIndex = bars.findIndex((bar) => bar.timestamp === entry.timestamp);
    const exitIndex = bars.findIndex((bar) => bar.timestamp === exit.timestamp);
    if (entryIndex < 0 || exitIndex <= entryIndex) continue;

    for (let index = entryIndex + 1; index <= exitIndex; index += 1) {
      const bar = bars[index];
      const action = bar.timestamp === exit.timestamp ? "EXIT" : "HOLD";
      const features = buildFeatures(entry.ticker, entry.timeframe, bar.timestamp);
      rows.push({
        candidate_id: `${trade.id}:${bar.timestamp}`,
        trade_id: trade.id,
        entry_label_id: entry.id,
        exit_label_id: exit.id,
        action,
        target_exit: action === "EXIT" ? 1 : 0,
        target_hold: action === "HOLD" ? 1 : 0,
        ticker: entry.ticker,
        timeframe: entry.timeframe,
        timestamp: bar.timestamp,
        bar_index: index,
        in_trade_bar_index: index - entryIndex,
        chart_price: bar.close,
        entry_timestamp: trade.entry_timestamp,
        exit_timestamp: trade.exit_timestamp,
        entry_price: trade.entry_price,
        exit_price: trade.exit_price,
        return_pct: trade.return_pct,
        ...Object.fromEntries(featureColumns.map(([featureKey, column]) => [
          column,
          features[featureKey]
        ]))
      });
    }
  }

  return rows;
}

export function tradeCandidatesCsv(labels: Label[], trades: Trade[]): string {
  const rows = buildTradeCandidateRows(labels, trades);
  return toCsv(rows, tradeCandidatesCsvColumns);
}

export function summarizeTradeCandidateCoverage(labels: Label[], trades: Trade[]) {
  const activeLabels = labels.filter((label) => label.deleted_at === null);
  const labelById = new Map(activeLabels.map((label) => [label.id, label]));
  const closedTrainingEligibleTradeIds = new Set<string>();
  const closedTradesWithCandidates = new Set<string>();
  const byAction: Record<string, number> = {};
  let rows = 0;

  for (const trade of trades.filter((item) => item.status === "closed" && item.exit_label_id)) {
    const entry = labelById.get(trade.entry_label_id);
    const exit = trade.exit_label_id ? labelById.get(trade.exit_label_id) : null;
    if (!entry || !exit || entry.training_eligible !== 1 || exit.training_eligible !== 1) continue;
    closedTrainingEligibleTradeIds.add(trade.id);

    const bars = getBars(entry.ticker, entry.timeframe);
    const entryIndex = bars.findIndex((bar) => bar.timestamp === entry.timestamp);
    const exitIndex = bars.findIndex((bar) => bar.timestamp === exit.timestamp);
    if (entryIndex < 0 || exitIndex <= entryIndex) continue;

    const candidateRows = exitIndex - entryIndex;
    const holdRows = Math.max(0, candidateRows - 1);
    rows += candidateRows;
    byAction.EXIT = (byAction.EXIT ?? 0) + 1;
    if (holdRows > 0) byAction.HOLD = (byAction.HOLD ?? 0) + holdRows;
    closedTradesWithCandidates.add(trade.id);
  }

  return {
    rows,
    byAction,
    closedTrades: closedTrainingEligibleTradeIds.size,
    closedTradesWithCandidates: closedTradesWithCandidates.size,
    missingClosedTradeCandidateIds: [...closedTrainingEligibleTradeIds]
      .filter((tradeId) => !closedTradesWithCandidates.has(tradeId))
      .sort()
  };
}

export function labelsJsonl(labels: Label[]): string {
  return labels.map((label) => JSON.stringify({
    ...label,
    reason_codes: JSON.parse(label.reason_codes_json || "[]"),
    features: JSON.parse(label.features_json || "{}")
  })).join("\n");
}

export function exportManifest(labels: Label[], trades: Trade[]): Record<string, unknown> {
  const activeLabels = labels.filter((label) => label.deleted_at === null);
  const labelById = new Map(activeLabels.map((label) => [label.id, label]));
  const trainingEligibleLabels = activeLabels.filter((label) => label.training_eligible === 1);
  const tradeCandidateRows = buildTradeCandidateRows(activeLabels, trades);
  const tradeCandidateCoverage = summarizeTradeCandidateCoverage(activeLabels, trades);
  const tradeCandidateIds = tradeCandidateRows.map((row) => String(row.candidate_id ?? "")).filter(Boolean);
  const tradeCandidateIdCounts = tradeCandidateIds.reduce<Record<string, number>>((counts, id) => {
    counts[id] = (counts[id] ?? 0) + 1;
    return counts;
  }, {});
  const tradeCandidateTradeIds = new Set(tradeCandidateRows.map((row) => String(row.trade_id ?? "")).filter(Boolean));
  const closedTrainingEligibleTradeIds = new Set(trades.filter((trade) => {
    if (trade.status !== "closed" || !trade.exit_label_id) return false;
    const entry = labelById.get(trade.entry_label_id);
    const exit = labelById.get(trade.exit_label_id);
    return entry?.training_eligible === 1 && exit?.training_eligible === 1;
  }).map((trade) => trade.id));
  const closedTradeIds = trades.filter((trade) => trade.status === "closed").map((trade) => trade.id);
  return {
    version: "edgelord.export_manifest.v1",
    createdAt: new Date().toISOString(),
    files: [
      "labels.csv",
      "trades.csv",
      "training-features.csv",
      "trade-candidates.csv",
      "labels.jsonl",
      "schema.json"
    ],
    labels: {
      total: activeLabels.length,
      trainingEligible: trainingEligibleLabels.length,
      excluded: activeLabels.length - trainingEligibleLabels.length,
      byAction: countBy(activeLabels, "action"),
      bySource: countBy(activeLabels, "label_source"),
      byCaptureMode: countBy(activeLabels, "capture_mode"),
      byTicker: countBy(activeLabels, "ticker"),
      byTimeframe: countBy(activeLabels, "timeframe")
    },
    trades: {
      total: trades.length,
      byStatus: countBy(trades, "status"),
      closed: closedTradeIds.length,
      trainingEligibleClosed: closedTrainingEligibleTradeIds.size,
      ineligibleClosed: closedTradeIds.length - closedTrainingEligibleTradeIds.size,
      open: trades.filter((trade) => trade.status === "open").map((trade) => ({
        id: trade.id,
        ticker: trade.ticker,
        entryLabelId: trade.entry_label_id,
        entryTimestamp: trade.entry_timestamp,
        entryPrice: trade.entry_price
      }))
    },
    tradeCandidates: {
      rows: tradeCandidateCoverage.rows,
      byAction: tradeCandidateCoverage.byAction,
      closedTrades: tradeCandidateCoverage.closedTrades,
      closedTradesWithCandidates: tradeCandidateCoverage.closedTradesWithCandidates,
      missingClosedTradeCandidateIds: tradeCandidateCoverage.missingClosedTradeCandidateIds,
      extraCandidateTradeIds: [...tradeCandidateTradeIds].filter((tradeId) => !closedTrainingEligibleTradeIds.has(tradeId)).sort(),
      duplicateCandidateIds: Object.entries(tradeCandidateIdCounts).filter(([, count]) => count > 1).map(([id]) => id).sort()
    },
    trainingPolicy: exportTrainingPolicy
  };
}

export function exportSchemaCatalog(): Record<string, unknown> {
  return {
    version: "edgelord.export_schema.v1",
    generatedAt: new Date().toISOString(),
    files: {
      "labels.csv": {
        role: "human-readable label ledger",
        columns: labelsCsvColumns
      },
      "trades.csv": {
        role: "paired entry/exit trade records",
        columns: tradesCsvColumns
      },
      "training-features.csv": {
        role: "training-eligible decision rows only",
        rowFilter: "training_eligible = 1",
        targetColumns: ["target_entry", "target_exit", "target_skip", "target_invalid"],
        priceColumns: {
          chart_price: "Stored candle close at label timestamp.",
          execution_price: "Optional actual execution price.",
          decision_price: "execution_price when present, otherwise chart_price."
        },
        columns: trainingFeaturesCsvColumns
      },
      "trade-candidates.csv": {
        role: "in-trade HOLD-vs-EXIT candidate rows for closed training-eligible trades",
        rowFilter: "closed trades where entry and exit labels are training eligible",
        targetColumns: ["target_exit", "target_hold"],
        columns: tradeCandidatesCsvColumns
      },
      "labels.jsonl": {
        role: "full label records with parsed reason_codes and features",
        columns: ["one JSON object per active label"]
      }
    },
    features: featureCatalog.map(({ featureKey, column, type, description }) => ({
      featureKey,
      column,
      type,
      description,
      computedFromFutureData: false,
      pineSupport: pineSupportedColumns.has(column) ? "mapped" : "research_only",
      pineExpression: pineFeatureExpressions[column] ?? null
    })),
    trainingPolicy: exportTrainingPolicy
  };
}

function countBy<T>(rows: T[], key: keyof T): Record<string, number> {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const value = String(row[key] ?? "(blank)");
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
