import type { AggregatedTimeframe } from "../aggregation/aggregateBars.js";
import type { SqliteDatabase } from "../db/database.js";

type AggregatedBarQualityRow = {
  ticker: string;
  timeframe: AggregatedTimeframe;
  timestamp: string;
  open: number;
  close: number;
};

export type DataQualityWarning = {
  code: "large_price_discontinuity";
  severity: "review" | "warning";
  classification: "leveraged_etf_volatility" | "session_gap" | "possible_bad_source_data";
  ticker: string;
  timeframe: AggregatedTimeframe;
  timestamp: string;
  previousTimestamp: string;
  closeToCloseReturnPercent: number;
  openGapPercent: number;
  message: string;
};

const CLOSE_TO_CLOSE_THRESHOLD_PERCENT = 30;
const OPEN_GAP_THRESHOLD_PERCENT = 20;
const BAD_SOURCE_CLOSE_TO_CLOSE_THRESHOLD_PERCENT = 80;
const BAD_SOURCE_OPEN_GAP_THRESHOLD_PERCENT = 60;
const LEVERAGED_ETFS = new Set(["SOXL", "SOXS"]);

function percentChange(current: number, previous: number): number {
  if (previous === 0) {
    return 0;
  }

  return ((current - previous) / previous) * 100;
}

function roundPercent(value: number): number {
  return Number(value.toFixed(2));
}

function placeholders(values: string[]): string {
  return values.map(() => "?").join(", ");
}

function classifyDiscontinuity(
  ticker: string,
  closeToCloseReturnPercent: number,
  openGapPercent: number
): Pick<DataQualityWarning, "severity" | "classification"> {
  if (
    Math.abs(closeToCloseReturnPercent) >= BAD_SOURCE_CLOSE_TO_CLOSE_THRESHOLD_PERCENT ||
    Math.abs(openGapPercent) >= BAD_SOURCE_OPEN_GAP_THRESHOLD_PERCENT
  ) {
    return {
      severity: "warning",
      classification: "possible_bad_source_data"
    };
  }

  if (
    Math.abs(openGapPercent) >= OPEN_GAP_THRESHOLD_PERCENT &&
    Math.abs(closeToCloseReturnPercent) < CLOSE_TO_CLOSE_THRESHOLD_PERCENT
  ) {
    return {
      severity: "review",
      classification: "session_gap"
    };
  }

  if (LEVERAGED_ETFS.has(ticker)) {
    return {
      severity: "review",
      classification: "leveraged_etf_volatility"
    };
  }

  return {
    severity: "warning",
    classification: "possible_bad_source_data"
  };
}

function warningMessage(
  row: AggregatedBarQualityRow,
  closeToCloseReturnPercent: number,
  openGapPercent: number,
  classification: DataQualityWarning["classification"]
): string {
  const prefix = `${row.ticker} ${row.timeframe} has a ${closeToCloseReturnPercent}% close-to-close move and ${openGapPercent}% open gap at ${row.timestamp}.`;

  if (classification === "leveraged_etf_volatility") {
    return `${prefix} Classified as leveraged ETF volatility for review, not an automatic bad-data warning.`;
  }

  if (classification === "session_gap") {
    return `${prefix} Classified as a session gap for review.`;
  }

  return `${prefix} Check for split, adjustment, or bad import data before trusting labels.`;
}

export function detectAggregatedBarDiscontinuities(
  db: SqliteDatabase,
  filters: { tickers?: string[]; timeframes?: AggregatedTimeframe[] } = {}
): DataQualityWarning[] {
  const clauses: string[] = [];
  const params: string[] = [];

  if (filters.tickers?.length) {
    clauses.push(`ticker in (${placeholders(filters.tickers)})`);
    params.push(...filters.tickers);
  }

  if (filters.timeframes?.length) {
    clauses.push(`timeframe in (${placeholders(filters.timeframes)})`);
    params.push(...filters.timeframes);
  }

  const rows = db
    .prepare(
      `select ticker, timeframe, timestamp, open, close
       from aggregated_bars
       ${clauses.length ? `where ${clauses.join(" and ")}` : ""}
       order by ticker asc, timeframe asc, timestamp asc`
    )
    .all(...params) as AggregatedBarQualityRow[];
  const warnings: DataQualityWarning[] = [];
  let previous: AggregatedBarQualityRow | null = null;

  for (const row of rows) {
    if (previous?.ticker !== row.ticker || previous.timeframe !== row.timeframe) {
      previous = row;
      continue;
    }

    const closeToCloseReturnPercent = roundPercent(percentChange(row.close, previous.close));
    const openGapPercent = roundPercent(percentChange(row.open, previous.close));

    if (
      Math.abs(closeToCloseReturnPercent) >= CLOSE_TO_CLOSE_THRESHOLD_PERCENT ||
      Math.abs(openGapPercent) >= OPEN_GAP_THRESHOLD_PERCENT
    ) {
      const classification = classifyDiscontinuity(
        row.ticker,
        closeToCloseReturnPercent,
        openGapPercent
      );

      warnings.push({
        code: "large_price_discontinuity",
        ...classification,
        ticker: row.ticker,
        timeframe: row.timeframe,
        timestamp: row.timestamp,
        previousTimestamp: previous.timestamp,
        closeToCloseReturnPercent,
        openGapPercent,
        message: warningMessage(
          row,
          closeToCloseReturnPercent,
          openGapPercent,
          classification.classification
        )
      });
    }

    previous = row;
  }

  return warnings;
}
