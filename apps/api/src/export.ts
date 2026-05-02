import type { Label, Trade } from "./schema";

const featureColumns = [
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

function csvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvValue(row[column])).join(","))].join("\n");
}

export function labelsCsv(labels: Label[]): string {
  const columns = [
    "id", "label_source", "training_eligible", "action", "ticker", "timeframe", "timestamp", "bar_index", "chart_price",
    "execution_price", "trade_id", "parent_entry_label_id", "capture_mode", "visible_until_timestamp",
    "potential_visual_leakage", "confidence", "setup_quality", "reason_codes", "notes", "created_at"
  ];
  return toCsv(labels.map((label) => ({ ...label, reason_codes: label.reason_codes_json })), columns);
}

export function tradesCsv(trades: Trade[]): string {
  const columns = ["trade_id", "ticker", "status", "entry_label_id", "exit_label_id", "entry_timestamp", "exit_timestamp", "entry_price", "exit_price", "return_pct"];
  return toCsv(trades.map((trade) => ({ ...trade, trade_id: trade.id })), columns);
}

export function trainingFeaturesCsv(labels: Label[]): string {
  const columns = [
    "label_id", "label_source", "capture_mode", "action", "ticker", "timeframe", "timestamp", "trade_id", "parent_entry_label_id",
    "chart_price", "visible_until_timestamp",
    ...featureColumns.map(([, column]) => column)
  ];
  const rows = labels.filter((label) => label.training_eligible === 1).map((label) => {
    const features = JSON.parse(label.features_json || "{}") as Record<string, unknown>;
    return {
      label_id: label.id,
      label_source: label.label_source,
      capture_mode: label.capture_mode,
      action: label.action,
      ticker: label.ticker,
      timeframe: label.timeframe,
      timestamp: label.timestamp,
      trade_id: label.trade_id,
      parent_entry_label_id: label.parent_entry_label_id,
      chart_price: label.chart_price,
      visible_until_timestamp: label.visible_until_timestamp,
      ...Object.fromEntries(featureColumns.map(([featureKey, column]) => [
        column,
        features[featureKey]
      ]))
    };
  });
  return toCsv(rows, columns);
}

export function labelsJsonl(labels: Label[]): string {
  return labels.map((label) => JSON.stringify({
    ...label,
    reason_codes: JSON.parse(label.reason_codes_json || "[]"),
    features: JSON.parse(label.features_json || "{}")
  })).join("\n");
}
