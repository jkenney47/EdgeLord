import { getBars } from "./bars";
import { buildFeatures } from "./indicators";
import type { Label, Trade } from "./schema";
import pineFeatureMap from "../../../research/pine_feature_map.json" with { type: "json" };

export const featureColumns = [
  ["close", "feature_close"],
  ["ema25", "feature_ema25"],
  ["sma100", "feature_sma100"],
  ["atr14", "feature_atr14"],
  ["stochRsiK", "feature_stoch_rsi_k"],
  ["stochRsiD", "feature_stoch_rsi_d"],
  ["closeAboveEma25", "feature_close_above_ema25"],
  ["closeAboveSma100", "feature_close_above_sma100"],
  ["distanceToEma25Pct", "feature_distance_to_ema25_pct"],
  ["distanceToSma100Pct", "feature_distance_to_sma100_pct"],
  ["recent5ReturnPct", "feature_recent_5_return_pct"],
  ["recent10ReturnPct", "feature_recent_10_return_pct"],
  ["recent20ReturnPct", "feature_recent_20_return_pct"],
  ["recent20High", "feature_recent_20_high"],
  ["recent20Low", "feature_recent_20_low"],
  ["closeRankRecent20", "feature_close_rank_recent_20"],
  ["pairedTicker", "feature_paired_ticker"],
  ["pairedClose", "feature_paired_close"],
  ["pairRatioClose", "feature_pair_ratio_close"],
  ["d1Close", "feature_d1_close"],
  ["d1CloseAboveEma25", "feature_d1_close_above_ema25"],
  ["h4Close", "feature_h4_close"],
  ["h4CloseAboveEma25", "feature_h4_close_above_ema25"],
  ["h2Close", "feature_h2_close"],
  ["h2CloseAboveEma25", "feature_h2_close_above_ema25"]
] as const;

const featureCatalog = [
  ["close", "feature_close", "number", "Selected candle close."],
  ["ema25", "feature_ema25", "number", "EMA 25 on the selected ticker/timeframe using bars through the selected candle."],
  ["sma100", "feature_sma100", "number", "SMA 100 on the selected ticker/timeframe using bars through the selected candle."],
  ["atr14", "feature_atr14", "number", "ATR 14 on the selected ticker/timeframe using bars through the selected candle."],
  ["stochRsiK", "feature_stoch_rsi_k", "number", "Stoch RSI K on the selected ticker/timeframe using bars through the selected candle."],
  ["stochRsiD", "feature_stoch_rsi_d", "number", "Stoch RSI D on the selected ticker/timeframe using bars through the selected candle."],
  ["closeAboveEma25", "feature_close_above_ema25", "boolean", "Whether close is above EMA 25."],
  ["closeAboveSma100", "feature_close_above_sma100", "boolean", "Whether close is above SMA 100."],
  ["distanceToEma25Pct", "feature_distance_to_ema25_pct", "number", "Percent distance from close to EMA 25."],
  ["distanceToSma100Pct", "feature_distance_to_sma100_pct", "number", "Percent distance from close to SMA 100."],
  ["recent5ReturnPct", "feature_recent_5_return_pct", "number", "Percent return over the prior 5 bars."],
  ["recent10ReturnPct", "feature_recent_10_return_pct", "number", "Percent return over the prior 10 bars."],
  ["recent20ReturnPct", "feature_recent_20_return_pct", "number", "Percent return over the prior 20 bars."],
  ["recent20High", "feature_recent_20_high", "number", "Highest high over the prior 20 bars including the selected candle."],
  ["recent20Low", "feature_recent_20_low", "number", "Lowest low over the prior 20 bars including the selected candle."],
  ["closeRankRecent20", "feature_close_rank_recent_20", "number", "Close position within the recent 20-bar high/low range."],
  ["pairedTicker", "feature_paired_ticker", "string", "Opposite ETF ticker for paired context."],
  ["pairedClose", "feature_paired_close", "number", "Opposite ETF close at the selected timestamp when available."],
  ["pairRatioClose", "feature_pair_ratio_close", "number", "Selected ticker close divided by paired ticker close."],
  ["d1Close", "feature_d1_close", "number", "1D close at or before the selected timestamp."],
  ["d1CloseAboveEma25", "feature_d1_close_above_ema25", "boolean", "Whether 1D close is above its EMA 25."],
  ["h4Close", "feature_h4_close", "number", "4H close at or before the selected timestamp."],
  ["h4CloseAboveEma25", "feature_h4_close_above_ema25", "boolean", "Whether 4H close is above its EMA 25."],
  ["h2Close", "feature_h2_close", "number", "2H close at or before the selected timestamp."],
  ["h2CloseAboveEma25", "feature_h2_close_above_ema25", "boolean", "Whether 2H close is above its EMA 25."]
] as const;

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

export function labelsJsonl(labels: Label[]): string {
  return labels.map((label) => JSON.stringify({
    ...label,
    reason_codes: JSON.parse(label.reason_codes_json || "[]"),
    features: JSON.parse(label.features_json || "{}")
  })).join("\n");
}

export function exportManifest(labels: Label[], trades: Trade[]): Record<string, unknown> {
  const activeLabels = labels.filter((label) => label.deleted_at === null);
  const trainingEligibleLabels = activeLabels.filter((label) => label.training_eligible === 1);
  const tradeCandidateRows = buildTradeCandidateRows(activeLabels, trades);
  const tradeCandidateTradeIds = new Set(tradeCandidateRows.map((row) => String(row.trade_id ?? "")).filter(Boolean));
  const closedTradeIds = new Set(trades.filter((trade) => trade.status === "closed").map((trade) => trade.id));
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
      open: trades.filter((trade) => trade.status === "open").map((trade) => ({
        id: trade.id,
        ticker: trade.ticker,
        entryLabelId: trade.entry_label_id,
        entryTimestamp: trade.entry_timestamp,
        entryPrice: trade.entry_price
      }))
    },
    tradeCandidates: {
      rows: tradeCandidateRows.length,
      byAction: countBy(tradeCandidateRows, "action"),
      closedTrades: closedTradeIds.size,
      closedTradesWithCandidates: [...closedTradeIds].filter((tradeId) => tradeCandidateTradeIds.has(tradeId)).length
    },
    trainingPolicy: {
      eligibleWhen: [
        "label_source is actual_trade and potential_visual_leakage is false",
        "label_source is retrospective_replay, capture_mode is replay, and potential_visual_leakage is false"
      ],
      excludedByDefault: [
        "retrospective_hindsight labels",
        "regular-mode retrospective labels",
        "labels with potential visual leakage",
        "orphan EXIT labels"
      ]
    }
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
    features: featureCatalog.map(([featureKey, column, type, description]) => ({
      featureKey,
      column,
      type,
      description,
      computedFromFutureData: false,
      pineSupport: pineSupportedColumns.has(column) ? "mapped" : "research_only",
      pineExpression: pineFeatureExpressions[column] ?? null
    })),
    trainingPolicy: {
      eligibleWhen: [
        "label_source is actual_trade and potential_visual_leakage is false",
        "label_source is retrospective_replay, capture_mode is replay, and potential_visual_leakage is false"
      ],
      excludedByDefault: [
        "retrospective_hindsight labels",
        "regular-mode retrospective labels",
        "labels with potential visual leakage",
        "orphan EXIT labels"
      ]
    }
  };
}

function countBy<T>(rows: T[], key: keyof T): Record<string, number> {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const value = String(row[key] ?? "(blank)");
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
