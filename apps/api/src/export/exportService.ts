import { listTradeEvents } from "../labels/labelService.js";
import type { TradeEventDto } from "../labels/labelService.js";
import type { SqliteDatabase } from "../db/database.js";
import { outcomeRuleVersion } from "../outcomes/outcomeVersions.js";
import type { ExportValidationReport } from "./exportValidationService.js";
import { exportVersions } from "./exportVersions.js";

type JsonRecord = Record<string, unknown>;
type ExportFormat = "json" | "csv";

export type TradeEventsExportManifest = {
  schemaVersion: string;
  exportVersion: string;
  indicatorCalcVersion: string;
  structureCalcVersion: string;
  exportedAt: string;
  format: ExportFormat;
  decisionFeatureExport: {
    outcomeFieldsIncluded: false;
  };
  outcomeFields: {
    classification: "evaluation_only";
    jsonIncluded: true;
    csvIncluded: false;
    ruleVersion: string;
  };
  filters: {
    sessionId: string | null;
  };
  qa: {
    status: "pass" | "warning" | "fail";
    blockers: number;
    warnings: number;
  };
  includedLabelTypes: Record<string, number>;
  rowCount: number;
};

export type TradeEventsJsonExport = {
  manifest: TradeEventsExportManifest;
  events: TradeEventDto[];
};

const csvColumns = [
  "schemaVersion",
  "exportVersion",
  "indicatorCalcVersion",
  "structureCalcVersion",
  "id",
  "sessionId",
  "timestamp",
  "ticker",
  "timeframe",
  "labelType",
  "decisionPhase",
  "captureMode",
  "visibleUntilTimestamp",
  "potentialVisualLeakage",
  "selectedBarIndex",
  "setupId",
  "tradeId",
  "parentLabelId",
  "decisionRole",
  "bias",
  "marketBias",
  "tradeDirection",
  "instrumentRole",
  "pairedTickerRole",
  "entryStyle",
  "exitStyle",
  "invalidationPrice",
  "targetPrice",
  "d1Timestamp",
  "d1ContextAgeMinutes",
  "d1Close",
  "d1Ema25",
  "d1Sma100",
  "d1MonthlyVwap",
  "d1SmioOscillator",
  "d1StochRsiK",
  "d1StochRsiD",
  "d1CmWvfPlot",
  "d1Atr14Rma",
  "d1RecentHigh",
  "d1RecentLow",
  "d1DistanceToRecentHigh",
  "d1DistanceToRecentLow",
  "h4Timestamp",
  "h4ContextAgeMinutes",
  "h4Close",
  "h4Ema25",
  "h4Sma100",
  "h4MonthlyVwap",
  "h4SmioOscillator",
  "h4StochRsiK",
  "h4StochRsiD",
  "h4CmWvfPlot",
  "h4Atr14Rma",
  "h4RecentHigh",
  "h4RecentLow",
  "h4DistanceToRecentHigh",
  "h4DistanceToRecentLow",
  "h2Timestamp",
  "h2ContextAgeMinutes",
  "h2Close",
  "h2Ema25",
  "h2Sma100",
  "h2MonthlyVwap",
  "h2SmioOscillator",
  "h2StochRsiK",
  "h2StochRsiD",
  "h2CmWvfPlot",
  "h2Atr14Rma",
  "h2RecentHigh",
  "h2RecentLow",
  "h2DistanceToRecentHigh",
  "h2DistanceToRecentLow",
  "decisionBarRange",
  "decisionBarBody",
  "decisionBarUpperWick",
  "decisionBarLowerWick",
  "decisionBarClosePositionInRange",
  "decisionBarReturn1Percent",
  "decisionBarGapFromPrevClosePercent",
  "decisionBarAtrNormalizedRange",
  "decisionCloseAboveEma25",
  "decisionCloseAboveSma100",
  "decisionCloseAboveMonthlyVwap",
  "decisionDistanceToEma25Percent",
  "decisionDistanceToSma100Percent",
  "decisionDistanceToMonthlyVwapPercent",
  "decisionDistanceToEma25Atr",
  "decisionDistanceToSma100Atr",
  "decisionDistanceToMonthlyVwapAtr",
  "decisionAtr14RmaPctOfClose",
  "decisionStochRsiKAboveD",
  "decisionStochRsiOverbought",
  "decisionStochRsiOversold",
  "decisionCmWvfSignalState",
  "decisionRecent5ReturnPercent",
  "decisionRecent10ReturnPercent",
  "decisionRecent20ReturnPercent",
  "decisionRecent5RangeAtr",
  "decisionRecent10RangeAtr",
  "decisionRecent20RangeAtr",
  "decisionCloseRankInRecent20Range",
  "decisionVolumeRankRecent20",
  "price",
  "confidence",
  "setupQuality",
  "reasonCodes",
  "notes",
  "indicatorTicker",
  "indicatorTimeframe",
  "indicatorTimestamp",
  "volume",
  "volumeSma20",
  "ema25",
  "ema25DistancePercent",
  "sma100",
  "sma100DistancePercent",
  "monthlyVwap",
  "monthlyVwapDistancePercent",
  "atr14Rma",
  "smioErg",
  "smioSignal",
  "smioOscillator",
  "stochRsi",
  "stochRsiStoch",
  "stochRsiK",
  "stochRsiD",
  "cmWvf",
  "cmWvfPlot",
  "cmWvfUpperBand",
  "cmWvfRangeHigh",
  "cmWvfFiltered",
  "cmWvfFilteredAggressive",
  "cmWvfAlert1",
  "cmWvfAlert2",
  "cmWvfAlert3",
  "cmWvfAlert4",
  "recentCandleCount",
  "recentHigh",
  "recentLow",
  "distanceToRecentHigh",
  "distanceToRecentLow",
  "recentCandleHighs",
  "recentCandleLows",
  "pairedTicker",
  "pairedTimestamp",
  "pairedOpen",
  "pairedHigh",
  "pairedLow",
  "pairedClose",
  "pairedVolume",
  "pairedVolumeSma20",
  "pairedEma25",
  "pairedSma100",
  "pairedMonthlyVwap",
  "pairedAtr14Rma",
  "pairedSmioOscillator",
  "pairedStochRsiK",
  "pairedStochRsiD",
  "pairedCmWvfPlot",
  "pairedCmWvfFiltered",
  "pairedCmWvfFilteredAggressive",
  "pairedContextMissing",
  "pairedReturn1Percent",
  "pairedCloseAboveEma25",
  "pairedCloseAboveSma100",
  "pairedCloseAboveMonthlyVwap",
  "pairedDistanceToEma25Percent",
  "pairedDistanceToSma100Percent",
  "pairedDistanceToMonthlyVwapPercent",
  "pairedAtr14RmaPctOfClose",
  "pairRatioClose",
  "pairRatioReturn1Percent",
  "pairRatioReturn5Percent",
  "pairRatioReturn10Percent",
  "pairRatioAboveSma20",
  "pairRatioSma20DistancePercent",
  "pairDivergenceFlag",
  "nearestTrendlineId",
  "nearestTrendlinePriceAtTimestamp",
  "nearestTrendlineSlope",
  "nearestTrendlineDistance",
  "nearestTrendlineDistancePercent",
  "nearestLevelId",
  "nearestLevelPrice",
  "nearestLevelDistance",
  "nearestLevelDistancePercent",
  "breakoutMarkerId",
  "createdAt",
  "updatedAt"
];

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function timeframeCsvFields(prefix: string, value: unknown): Record<string, unknown> {
  const context = objectValue(value);
  const candle = objectValue(context.candle);
  const indicator = objectValue(context.indicator);
  const smio = objectValue(indicator.smio);
  const stochRsi = objectValue(indicator.stochRsi);
  const cmWvf = objectValue(indicator.cmWvf);
  const structure = objectValue(context.structureSnapshot);

  return {
    [`${prefix}Timestamp`]: stringValue(context.timestamp),
    [`${prefix}ContextAgeMinutes`]: numberValue(context.contextAgeMinutes),
    [`${prefix}Close`]: numberValue(candle.close),
    [`${prefix}Ema25`]: numberValue(indicator.ema25),
    [`${prefix}Sma100`]: numberValue(indicator.sma100),
    [`${prefix}MonthlyVwap`]: numberValue(indicator.monthlyVwap),
    [`${prefix}SmioOscillator`]: numberValue(smio.oscillator),
    [`${prefix}StochRsiK`]: numberValue(stochRsi.k),
    [`${prefix}StochRsiD`]: numberValue(stochRsi.d),
    [`${prefix}CmWvfPlot`]: numberValue(cmWvf.plot),
    [`${prefix}Atr14Rma`]: numberValue(indicator.atr14Rma),
    [`${prefix}RecentHigh`]: numberValue(structure.recentHigh),
    [`${prefix}RecentLow`]: numberValue(structure.recentLow),
    [`${prefix}DistanceToRecentHigh`]: numberValue(structure.distanceToRecentHigh),
    [`${prefix}DistanceToRecentLow`]: numberValue(structure.distanceToRecentLow)
  };
}

function distancePercent(price: number, value: unknown): number | null {
  const numeric = numberValue(value);
  if (numeric === null || price === 0) {
    return null;
  }

  return round6(((price - numeric) / price) * 100);
}

function distanceAtr(price: number, value: unknown, atr: unknown): number | null {
  const numeric = numberValue(value);
  const atrValue = numberValue(atr);
  if (numeric === null || atrValue === null || atrValue === 0) {
    return null;
  }

  return round6((price - numeric) / atrValue);
}

function percentChange(current: unknown, previous: unknown): number | null {
  const currentValue = numberValue(current);
  const previousValue = numberValue(previous);
  if (currentValue === null || previousValue === null || previousValue === 0) {
    return null;
  }

  return round6(((currentValue - previousValue) / previousValue) * 100);
}

function ratio(current: unknown, base: unknown): number | null {
  const currentValue = numberValue(current);
  const baseValue = numberValue(base);
  if (currentValue === null || baseValue === null || baseValue === 0) {
    return null;
  }

  return round6(currentValue / baseValue);
}

function boolFromNumbers(left: unknown, right: unknown, predicate: (left: number, right: number) => boolean): boolean | null {
  const leftValue = numberValue(left);
  const rightValue = numberValue(right);
  return leftValue === null || rightValue === null ? null : predicate(leftValue, rightValue);
}

function recentCandleObjects(values: unknown): JsonRecord[] {
  return Array.isArray(values) ? values.map((item) => objectValue(item)) : [];
}

function rangeForCandles(candles: JsonRecord[]): number | null {
  const highs = candles.map((candle) => numberValue(candle.high)).filter((value): value is number => value !== null);
  const lows = candles.map((candle) => numberValue(candle.low)).filter((value): value is number => value !== null);
  if (highs.length === 0 || lows.length === 0) {
    return null;
  }

  return round6(Math.max(...highs) - Math.min(...lows));
}

function returnForLookback(candles: JsonRecord[], lookback: number): number | null {
  if (candles.length < lookback) {
    return null;
  }

  const current = candles[candles.length - 1];
  const previous = candles[candles.length - lookback];
  return percentChange(current.close, previous.close);
}

function rangeAtrForLookback(candles: JsonRecord[], lookback: number, atr: unknown): number | null {
  if (candles.length < lookback) {
    return null;
  }

  return ratio(rangeForCandles(candles.slice(-lookback)), atr);
}

function percentileRank(values: Array<number | null>, value: number | null): number | null {
  const validValues = values.filter((item): item is number => item !== null);
  if (validValues.length === 0 || value === null) {
    return null;
  }

  return round6(validValues.filter((item) => item <= value).length / validValues.length);
}

function decisionFeatureFields(
  event: TradeEventDto,
  indicator: JsonRecord,
  stochRsi: JsonRecord,
  cmWvf: JsonRecord,
  structure: JsonRecord
): Record<string, unknown> {
  const recentCandles = recentCandleObjects(structure.recentCandles);
  const selectedCandle = recentCandles.at(-1) ?? {};
  const previousCandle = recentCandles.at(-2) ?? {};
  const open = numberValue(selectedCandle.open);
  const high = numberValue(selectedCandle.high);
  const low = numberValue(selectedCandle.low);
  const close = numberValue(selectedCandle.close) ?? event.price;
  const atr = numberValue(indicator.atr14Rma);
  const barRange = high !== null && low !== null ? round6(high - low) : null;
  const barBody = open !== null && close !== null ? round6(Math.abs(close - open)) : null;
  const upperWick =
    high !== null && open !== null && close !== null ? round6(high - Math.max(open, close)) : null;
  const lowerWick =
    low !== null && open !== null && close !== null ? round6(Math.min(open, close) - low) : null;
  const closePosition =
    high !== null && low !== null && close !== null && high !== low
      ? round6((close - low) / (high - low))
      : null;
  const recentHigh = numberValue(structure.recentHigh);
  const recentLow = numberValue(structure.recentLow);
  const recentRange =
    recentHigh !== null && recentLow !== null && recentHigh !== recentLow
      ? recentHigh - recentLow
      : null;
  const closeRank =
    close !== null && recentLow !== null && recentRange !== null
      ? round6((close - recentLow) / recentRange)
      : null;
  const cmWvfState =
    booleanValue(cmWvf.filteredAggressive) === true
      ? "aggressive_spike"
      : booleanValue(cmWvf.filtered) === true
        ? "spike"
        : "normal";

  return {
    decisionBarRange: barRange,
    decisionBarBody: barBody,
    decisionBarUpperWick: upperWick,
    decisionBarLowerWick: lowerWick,
    decisionBarClosePositionInRange: closePosition,
    decisionBarReturn1Percent: percentChange(close, previousCandle.close),
    decisionBarGapFromPrevClosePercent: percentChange(open, previousCandle.close),
    decisionBarAtrNormalizedRange: ratio(barRange, atr),
    decisionCloseAboveEma25: boolFromNumbers(close, indicator.ema25, (left, right) => left > right),
    decisionCloseAboveSma100: boolFromNumbers(close, indicator.sma100, (left, right) => left > right),
    decisionCloseAboveMonthlyVwap: boolFromNumbers(close, indicator.monthlyVwap, (left, right) => left > right),
    decisionDistanceToEma25Percent: distancePercent(close, indicator.ema25),
    decisionDistanceToSma100Percent: distancePercent(close, indicator.sma100),
    decisionDistanceToMonthlyVwapPercent: distancePercent(close, indicator.monthlyVwap),
    decisionDistanceToEma25Atr: distanceAtr(close, indicator.ema25, atr),
    decisionDistanceToSma100Atr: distanceAtr(close, indicator.sma100, atr),
    decisionDistanceToMonthlyVwapAtr: distanceAtr(close, indicator.monthlyVwap, atr),
    decisionAtr14RmaPctOfClose: atr === null || close === 0 ? null : round6((atr / close) * 100),
    decisionStochRsiKAboveD: boolFromNumbers(stochRsi.k, stochRsi.d, (left, right) => left > right),
    decisionStochRsiOverbought: boolFromNumbers(stochRsi.k, 80, (left, right) => left >= right),
    decisionStochRsiOversold: boolFromNumbers(stochRsi.k, 20, (left, right) => left <= right),
    decisionCmWvfSignalState: cmWvfState,
    decisionRecent5ReturnPercent: returnForLookback(recentCandles, 5),
    decisionRecent10ReturnPercent: returnForLookback(recentCandles, 10),
    decisionRecent20ReturnPercent: returnForLookback(recentCandles, 20),
    decisionRecent5RangeAtr: rangeAtrForLookback(recentCandles, 5, atr),
    decisionRecent10RangeAtr: rangeAtrForLookback(recentCandles, 10, atr),
    decisionRecent20RangeAtr: rangeAtrForLookback(recentCandles, 20, atr),
    decisionCloseRankInRecent20Range: closeRank,
    decisionVolumeRankRecent20: percentileRank(
      recentCandles.map((candle) => numberValue(candle.volume)),
      numberValue(selectedCandle.volume)
    )
  };
}

function pairedFeatureFields(
  event: TradeEventDto,
  indicator: JsonRecord,
  structure: JsonRecord,
  pairedTicker: JsonRecord,
  pairedCandle: JsonRecord,
  pairedIndicator: JsonRecord
): Record<string, unknown> {
  const selectedRecentCandles = recentCandleObjects(structure.recentCandles);
  const pairedStructure = objectValue(pairedTicker.structureSnapshot);
  const pairedRecentCandles = recentCandleObjects(pairedStructure.recentCandles);
  const pairedClose = numberValue(pairedCandle.close);
  const selectedClose = event.price;
  const ratioClose = ratio(selectedClose, pairedClose);
  const ratioCandles = selectedRecentCandles
    .map((selectedCandle, index) => ({
      selectedClose: numberValue(selectedCandle.close),
      pairedClose: numberValue(pairedRecentCandles[index]?.close)
    }))
    .map((item) => ratio(item.selectedClose, item.pairedClose))
    .filter((value): value is number => value !== null);
  const ratioSma20 =
    ratioCandles.length >= 20
      ? round6(ratioCandles.slice(-20).reduce((sum, value) => sum + value, 0) / 20)
      : null;
  const selectedAboveEma = boolFromNumbers(selectedClose, indicator.ema25, (left, right) => left > right);
  const pairedAboveEma = boolFromNumbers(pairedClose, pairedIndicator.ema25, (left, right) => left > right);

  return {
    pairedContextMissing: pairedClose === null,
    pairedReturn1Percent: percentChange(pairedClose, pairedRecentCandles.at(-2)?.close),
    pairedCloseAboveEma25: pairedAboveEma,
    pairedCloseAboveSma100: boolFromNumbers(pairedClose, pairedIndicator.sma100, (left, right) => left > right),
    pairedCloseAboveMonthlyVwap: boolFromNumbers(
      pairedClose,
      pairedIndicator.monthlyVwap,
      (left, right) => left > right
    ),
    pairedDistanceToEma25Percent: pairedClose === null ? null : distancePercent(pairedClose, pairedIndicator.ema25),
    pairedDistanceToSma100Percent: pairedClose === null ? null : distancePercent(pairedClose, pairedIndicator.sma100),
    pairedDistanceToMonthlyVwapPercent:
      pairedClose === null ? null : distancePercent(pairedClose, pairedIndicator.monthlyVwap),
    pairedAtr14RmaPctOfClose:
      pairedClose === null || pairedClose === 0 || numberValue(pairedIndicator.atr14Rma) === null
        ? null
        : round6((numberValue(pairedIndicator.atr14Rma)! / pairedClose) * 100),
    pairRatioClose: ratioClose,
    pairRatioReturn1Percent: percentChange(ratioClose, ratioCandles.at(-2)),
    pairRatioReturn5Percent: ratioCandles.length >= 5 ? percentChange(ratioClose, ratioCandles.at(-5)) : null,
    pairRatioReturn10Percent: ratioCandles.length >= 10 ? percentChange(ratioClose, ratioCandles.at(-10)) : null,
    pairRatioAboveSma20:
      ratioClose === null || ratioSma20 === null ? null : ratioClose > ratioSma20,
    pairRatioSma20DistancePercent:
      ratioClose === null || ratioSma20 === null ? null : distancePercent(ratioClose, ratioSma20),
    pairDivergenceFlag:
      selectedAboveEma === null || pairedAboveEma === null ? null : selectedAboveEma === pairedAboveEma
  };
}

function numberFieldList(values: unknown, field: string): string | null {
  if (!Array.isArray(values)) {
    return null;
  }

  const numbers = values
    .map((item) => objectValue(item))
    .map((item) => numberValue(item[field]))
    .filter((value): value is number => value !== null);

  return numbers.length > 0 ? numbers.join("|") : null;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = Array.isArray(value) ? value.join("|") : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildExportManifest(
  format: ExportFormat,
  sessionId: string | undefined,
  rowCount: number,
  validation?: ExportValidationReport
): TradeEventsExportManifest {
  return {
    ...exportVersions,
    exportedAt: new Date().toISOString(),
    format,
    decisionFeatureExport: {
      outcomeFieldsIncluded: false
    },
    outcomeFields: {
      classification: "evaluation_only",
      jsonIncluded: true,
      csvIncluded: false,
      ruleVersion: outcomeRuleVersion
    },
    filters: {
      sessionId: sessionId ?? null
    },
    qa: {
      status: validation?.status ?? "pass",
      blockers: validation?.summary.errorCount ?? 0,
      warnings: validation?.summary.warningCount ?? 0
    },
    includedLabelTypes: validation?.summary.labelsByLabelType ?? {},
    rowCount
  };
}

function eventToCsvRow(event: TradeEventDto): Record<string, unknown> {
  const indicator = objectValue(event.indicatorSnapshot);
  const smio = objectValue(indicator.smio);
  const stochRsi = objectValue(indicator.stochRsi);
  const cmWvf = objectValue(indicator.cmWvf);
  const structure = objectValue(event.structureSnapshot);
  const pairedTicker = objectValue(indicator.pairedTicker);
  const pairedCandle = objectValue(pairedTicker.candle);
  const pairedIndicator = objectValue(pairedTicker.indicator);
  const pairedSmio = objectValue(pairedIndicator.smio);
  const pairedStochRsi = objectValue(pairedIndicator.stochRsi);
  const pairedCmWvf = objectValue(pairedIndicator.cmWvf);
  const drawingContext = objectValue(event.drawingContext);
  const nearestTrendline = objectValue(drawingContext.nearestTrendline);
  const nearestLevel = objectValue(drawingContext.nearestLevel);
  const breakoutMarker = objectValue(drawingContext.breakoutMarker);
  const recentCandles = structure.recentCandles;
  const multiTimeframeContext = objectValue(event.multiTimeframeContext);

  return {
    schemaVersion: exportVersions.schemaVersion,
    exportVersion: exportVersions.exportVersion,
    indicatorCalcVersion: exportVersions.indicatorCalcVersion,
    structureCalcVersion: exportVersions.structureCalcVersion,
    id: event.id,
    sessionId: event.sessionId,
    timestamp: event.timestamp,
    ticker: event.ticker,
    timeframe: event.timeframe,
    labelType: event.labelType,
    decisionPhase: event.decisionPhase,
    captureMode: event.captureMode,
    visibleUntilTimestamp: event.visibleUntilTimestamp,
    potentialVisualLeakage: event.potentialVisualLeakage,
    selectedBarIndex: event.selectedBarIndex,
    setupId: event.setupId,
    tradeId: event.tradeId,
    parentLabelId: event.parentLabelId,
    decisionRole: event.decisionRole,
    bias: event.bias,
    marketBias: event.marketBias,
    tradeDirection: event.tradeDirection,
    instrumentRole: event.instrumentRole,
    pairedTickerRole: event.pairedTickerRole,
    entryStyle: event.entryStyle,
    exitStyle: event.exitStyle,
    invalidationPrice: event.invalidationPrice,
    targetPrice: event.targetPrice,
    ...timeframeCsvFields("d1", multiTimeframeContext.d1),
    ...timeframeCsvFields("h4", multiTimeframeContext.h4),
    ...timeframeCsvFields("h2", multiTimeframeContext.h2),
    ...decisionFeatureFields(event, indicator, stochRsi, cmWvf, structure),
    price: event.price,
    confidence: event.confidence,
    setupQuality: event.setupQuality,
    reasonCodes: event.reasonCodes,
    notes: event.notes,
    indicatorTicker: stringValue(indicator.ticker),
    indicatorTimeframe: stringValue(indicator.timeframe),
    indicatorTimestamp: stringValue(indicator.timestamp),
    volume: numberValue(indicator.volume),
    volumeSma20: numberValue(indicator.volumeSma20),
    ema25: numberValue(indicator.ema25),
    ema25DistancePercent: distancePercent(event.price, indicator.ema25),
    sma100: numberValue(indicator.sma100),
    sma100DistancePercent: distancePercent(event.price, indicator.sma100),
    monthlyVwap: numberValue(indicator.monthlyVwap),
    monthlyVwapDistancePercent: distancePercent(event.price, indicator.monthlyVwap),
    atr14Rma: numberValue(indicator.atr14Rma),
    smioErg: numberValue(smio.erg),
    smioSignal: numberValue(smio.signal),
    smioOscillator: numberValue(smio.oscillator),
    stochRsi: numberValue(stochRsi.rsi),
    stochRsiStoch: numberValue(stochRsi.stoch),
    stochRsiK: numberValue(stochRsi.k),
    stochRsiD: numberValue(stochRsi.d),
    cmWvf: numberValue(cmWvf.wvf),
    cmWvfPlot: numberValue(cmWvf.plot),
    cmWvfUpperBand: numberValue(cmWvf.upperBand),
    cmWvfRangeHigh: numberValue(cmWvf.rangeHigh),
    cmWvfFiltered: booleanValue(cmWvf.filtered),
    cmWvfFilteredAggressive: booleanValue(cmWvf.filteredAggressive),
    cmWvfAlert1: booleanValue(cmWvf.alert1),
    cmWvfAlert2: booleanValue(cmWvf.alert2),
    cmWvfAlert3: booleanValue(cmWvf.alert3),
    cmWvfAlert4: booleanValue(cmWvf.alert4),
    recentCandleCount: Array.isArray(recentCandles) ? recentCandles.length : null,
    recentHigh: numberValue(structure.recentHigh),
    recentLow: numberValue(structure.recentLow),
    distanceToRecentHigh: numberValue(structure.distanceToRecentHigh),
    distanceToRecentLow: numberValue(structure.distanceToRecentLow),
    recentCandleHighs: numberFieldList(recentCandles, "high"),
    recentCandleLows: numberFieldList(recentCandles, "low"),
    pairedTicker: stringValue(pairedTicker.ticker),
    pairedTimestamp: stringValue(pairedCandle.timestamp),
    pairedOpen: numberValue(pairedCandle.open),
    pairedHigh: numberValue(pairedCandle.high),
    pairedLow: numberValue(pairedCandle.low),
    pairedClose: numberValue(pairedCandle.close),
    pairedVolume: numberValue(pairedCandle.volume),
    pairedVolumeSma20: numberValue(pairedIndicator.volumeSma20),
    pairedEma25: numberValue(pairedIndicator.ema25),
    pairedSma100: numberValue(pairedIndicator.sma100),
    pairedMonthlyVwap: numberValue(pairedIndicator.monthlyVwap),
    pairedAtr14Rma: numberValue(pairedIndicator.atr14Rma),
    pairedSmioOscillator: numberValue(pairedSmio.oscillator),
    pairedStochRsiK: numberValue(pairedStochRsi.k),
    pairedStochRsiD: numberValue(pairedStochRsi.d),
    pairedCmWvfPlot: numberValue(pairedCmWvf.plot),
    pairedCmWvfFiltered: booleanValue(pairedCmWvf.filtered),
    pairedCmWvfFilteredAggressive: booleanValue(pairedCmWvf.filteredAggressive),
    ...pairedFeatureFields(event, indicator, structure, pairedTicker, pairedCandle, pairedIndicator),
    nearestTrendlineId: stringValue(nearestTrendline.id),
    nearestTrendlinePriceAtTimestamp: numberValue(nearestTrendline.priceAtTimestamp),
    nearestTrendlineSlope: numberValue(nearestTrendline.slope),
    nearestTrendlineDistance: numberValue(nearestTrendline.distance),
    nearestTrendlineDistancePercent: distancePercent(event.price, nearestTrendline.priceAtTimestamp),
    nearestLevelId: stringValue(nearestLevel.id),
    nearestLevelPrice: numberValue(nearestLevel.price),
    nearestLevelDistance: numberValue(nearestLevel.distance),
    nearestLevelDistancePercent: distancePercent(event.price, nearestLevel.price),
    breakoutMarkerId: stringValue(breakoutMarker.id),
    createdAt: event.createdAt,
    updatedAt: event.updatedAt
  };
}

export function exportTradeEventsJson(
  db: SqliteDatabase,
  sessionId?: string,
  validation?: ExportValidationReport
): TradeEventsJsonExport {
  const events = listTradeEvents(db, { sessionId });

  return {
    manifest: buildExportManifest("json", sessionId, events.length, validation),
    events
  };
}

export function exportTradeEventsCsv(db: SqliteDatabase, sessionId?: string): string {
  const rows = listTradeEvents(db, { sessionId }).map(eventToCsvRow);
  const header = csvColumns.join(",");
  const body = rows.map((row) => csvColumns.map((column) => csvEscape(row[column])).join(","));

  return [header, ...body].join("\n");
}
