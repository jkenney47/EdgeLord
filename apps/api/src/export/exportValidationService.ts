import { listTradeEvents } from "../labels/labelService.js";
import type { TradeEventDto } from "../labels/labelService.js";
import type { SqliteDatabase } from "../db/database.js";
import { detectAggregatedBarDiscontinuities } from "../market-data/dataQuality.js";

type JsonRecord = Record<string, unknown>;
type ValidationSeverity = "error" | "warning";

export type ExportValidationIssue = {
  severity: ValidationSeverity;
  code: string;
  labelId: string | null;
  message: string;
};

export type ExportValidationReport = {
  status: "pass" | "warning" | "fail";
  summary: {
    totalLabels: number;
    errorCount: number;
    warningCount: number;
    labelsByTicker: Record<string, number>;
    labelsByTimeframe: Record<string, number>;
    labelsByLabelType: Record<string, number>;
    labelsByReplayMode: Record<string, number>;
    labelsByDecisionRole: Record<string, number>;
    labelsByBias: Record<string, number>;
    labelsByTradeDirection: Record<string, number>;
    labelsWithMissingPairedContext: number;
    labelsWithLeakageWarnings: number;
    labelsWithIncompleteIntent: number;
    labelsWithSetupId: number;
    labelsWithTradeId: number;
    labelsWithOutcomeAvailable: number;
    labelsByOutcomeStatus: Record<string, number>;
    outcomeRuleVersions: Record<string, number>;
    outcomeFieldsExcludedFromDecisionCsv: boolean;
  };
  issues: ExportValidationIssue[];
};

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isEmptyObject(value: unknown): boolean {
  return Object.keys(objectValue(value)).length === 0;
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function timestampAfter(left: string | null, right: string | null): boolean {
  if (!left || !right) {
    return false;
  }

  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime > rightTime;
}

function drawingIdsForEvent(event: TradeEventDto): string[] {
  const drawingContext = objectValue(event.drawingContext);
  const nearestTrendline = objectValue(drawingContext.nearestTrendline);
  const nearestLevel = objectValue(drawingContext.nearestLevel);
  const breakoutMarker = objectValue(drawingContext.breakoutMarker);

  return [nearestTrendline.id, nearestLevel.id, breakoutMarker.id].filter(
    (id): id is string => typeof id === "string" && id.length > 0
  );
}

function existingDrawingIds(db: SqliteDatabase, ids: string[]): Set<string> {
  if (ids.length === 0) {
    return new Set();
  }

  const placeholders = ids.map(() => "?").join(", ");
  const rows = db
    .prepare(`select id from drawings where deleted_at is null and id in (${placeholders})`)
    .all(...ids) as Array<{ id: string }>;

  return new Set(rows.map((row) => row.id));
}

function pushIssue(
  issues: ExportValidationIssue[],
  severity: ValidationSeverity,
  code: string,
  labelId: string | null,
  message: string
): void {
  issues.push({
    severity,
    code,
    labelId,
    message
  });
}

function derivedOutcomeStatus(event: TradeEventDto, events: TradeEventDto[]): TradeEventDto["outcomeStatus"] {
  if (event.outcomeAvailable || event.outcomeStatus === "computed") {
    return "computed";
  }

  if (event.outcomeStatus === "insufficient_future_bars" || event.outcomeStatus === "pending") {
    return event.outcomeStatus;
  }

  const relatedInvalidation = events.some(
    (candidate) =>
      candidate.id !== event.id &&
      (candidate.labelType === "INVALID" || candidate.decisionRole === "invalid") &&
      ((event.tradeId && candidate.tradeId === event.tradeId) ||
        (event.setupId && candidate.setupId === event.setupId) ||
        candidate.parentLabelId === event.id)
  );

  if (event.labelType === "INVALID" || event.decisionRole === "invalid" || relatedInvalidation) {
    return "invalidated";
  }

  const linkedExit = events.some(
    (candidate) =>
      candidate.id !== event.id &&
      (candidate.labelType === "EXIT" || candidate.decisionRole === "exit") &&
      ((event.tradeId && candidate.tradeId === event.tradeId) || candidate.parentLabelId === event.id)
  );

  if (event.labelType === "ENTRY" && event.tradeId && !linkedExit) {
    return "missing_exit";
  }

  return event.outcomeStatus;
}

function validateEvent(
  db: SqliteDatabase,
  event: TradeEventDto,
  issues: ExportValidationIssue[]
): {
  missingPairedContext: boolean;
  leakageWarning: boolean;
  incompleteIntent: boolean;
  incompleteOutcome: boolean;
} {
  const indicator = objectValue(event.indicatorSnapshot);
  const structure = objectValue(event.structureSnapshot);
  const pairedTicker = objectValue(indicator.pairedTicker);
  const pairedCandle = objectValue(pairedTicker.candle);
  const multiTimeframeContext = objectValue(event.multiTimeframeContext);
  const visibleUntilTimestamp = event.visibleUntilTimestamp || event.timestamp;
  const recentCandles = Array.isArray(structure.recentCandles)
    ? structure.recentCandles.map((item) => objectValue(item))
    : [];
  const selectedCandle = recentCandles.find((candle) => stringValue(candle.timestamp) === event.timestamp);

  if (timestampAfter(event.timestamp, visibleUntilTimestamp)) {
    pushIssue(
      issues,
      "error",
      "selected_timestamp_after_visible_until",
      event.id,
      "Selected candle timestamp is after visibleUntilTimestamp."
    );
  }

  let leakageWarning = false;
  if (event.captureMode === "regular" || event.potentialVisualLeakage) {
    leakageWarning = true;
    pushIssue(
      issues,
      "warning",
      "potential_visual_leakage",
      event.id,
      "Regular-mode label is visually leakage-prone."
    );
  }

  if (isEmptyObject(indicator)) {
    pushIssue(issues, "error", "missing_indicator_snapshot", event.id, "Indicator snapshot is missing.");
  }

  if (isEmptyObject(structure)) {
    pushIssue(issues, "error", "missing_structure_snapshot", event.id, "Structure snapshot is missing.");
  } else if (!selectedCandle) {
    pushIssue(
      issues,
      "warning",
      "selected_candle_not_in_structure_snapshot",
      event.id,
      "Structure snapshot does not include the selected candle timestamp."
    );
  }

  const missingPairedContext = isEmptyObject(pairedTicker) || isEmptyObject(pairedCandle);
  if (missingPairedContext) {
    pushIssue(
      issues,
      "warning",
      "missing_paired_context",
      event.id,
      "Paired ETF context is missing or incomplete."
    );
  }

  for (const key of ["d1", "h4", "h2"]) {
    const context = objectValue(multiTimeframeContext[key]);
    const timestamp = stringValue(context.timestamp);

    if (!timestamp) {
      pushIssue(
        issues,
        "warning",
        `missing_${key}_context`,
        event.id,
        `${key} multi-timeframe context is missing.`
      );
      continue;
    }

    if (timestampAfter(timestamp, visibleUntilTimestamp)) {
      pushIssue(
        issues,
        "error",
        `${key}_context_after_visible_until`,
        event.id,
        `${key} context timestamp is after visibleUntilTimestamp.`
      );
    }
  }

  const drawingIds = drawingIdsForEvent(event);
  if (drawingIds.length > 0) {
    const existingIds = existingDrawingIds(db, drawingIds);
    for (const drawingId of drawingIds) {
      if (!existingIds.has(drawingId)) {
        pushIssue(
          issues,
          "warning",
          "drawing_reference_missing",
          event.id,
          `Drawing reference ${drawingId} does not point to an active drawing.`
        );
      }
    }
  }

  const incompleteIntent =
    (event.labelType === "ENTRY" &&
      (event.bias === "unclear" || event.tradeDirection === "observe_only" || !event.setupId)) ||
    (event.labelType === "EXIT" && !event.tradeId && !event.parentLabelId);
  if (incompleteIntent) {
    pushIssue(
      issues,
      "warning",
      event.labelType === "EXIT" ? "exit_linkage_incomplete" : "entry_intent_incomplete",
      event.id,
      event.labelType === "EXIT"
        ? "EXIT label is missing tradeId or parentLabelId linkage."
        : "ENTRY label is missing explicit setup, bias, or trade direction intent."
    );
  }

  const incompleteOutcome =
    event.outcomeAvailable &&
    (event.outcomeHorizonBars === null ||
      event.outcomeStatus !== "computed" ||
      !event.outcomeRuleVersion);
  if (incompleteOutcome) {
    pushIssue(
      issues,
      "warning",
      "outcome_metadata_incomplete",
      event.id,
      "Outcome is marked available without an outcome horizon."
    );
  }

  return {
    missingPairedContext,
    leakageWarning,
    incompleteIntent,
    incompleteOutcome
  };
}

export function buildExportValidationReport(
  db: SqliteDatabase,
  filters: { sessionId?: string } = {}
): ExportValidationReport {
  const events = listTradeEvents(db, filters);
  const issues: ExportValidationIssue[] = [];
  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  const summary = {
    totalLabels: events.length,
    errorCount: 0,
    warningCount: 0,
    labelsByTicker: {} as Record<string, number>,
    labelsByTimeframe: {} as Record<string, number>,
    labelsByLabelType: {} as Record<string, number>,
    labelsByReplayMode: {} as Record<string, number>,
    labelsByDecisionRole: {} as Record<string, number>,
    labelsByBias: {} as Record<string, number>,
    labelsByTradeDirection: {} as Record<string, number>,
    labelsWithMissingPairedContext: 0,
    labelsWithLeakageWarnings: 0,
    labelsWithIncompleteIntent: 0,
    labelsWithSetupId: 0,
    labelsWithTradeId: 0,
    labelsWithOutcomeAvailable: 0,
    labelsByOutcomeStatus: {} as Record<string, number>,
    outcomeRuleVersions: {} as Record<string, number>,
    outcomeFieldsExcludedFromDecisionCsv: true
  };

  for (const event of events) {
    increment(summary.labelsByTicker, event.ticker);
    increment(summary.labelsByTimeframe, event.timeframe);
    increment(summary.labelsByLabelType, event.labelType);
    increment(summary.labelsByReplayMode, event.captureMode);
    increment(summary.labelsByDecisionRole, event.decisionRole);
    increment(summary.labelsByBias, event.bias);
    increment(summary.labelsByTradeDirection, event.tradeDirection);
    summary.labelsWithSetupId += event.setupId ? 1 : 0;
    summary.labelsWithTradeId += event.tradeId ? 1 : 0;
    summary.labelsWithOutcomeAvailable += event.outcomeAvailable ? 1 : 0;
    increment(summary.labelsByOutcomeStatus, derivedOutcomeStatus(event, events));
    if (event.outcomeRuleVersion) {
      increment(summary.outcomeRuleVersions, event.outcomeRuleVersion);
    }

    if (seenIds.has(event.id)) {
      duplicateIds.add(event.id);
    }
    seenIds.add(event.id);

    const flags = validateEvent(db, event, issues);
    summary.labelsWithMissingPairedContext += flags.missingPairedContext ? 1 : 0;
    summary.labelsWithLeakageWarnings += flags.leakageWarning ? 1 : 0;
    summary.labelsWithIncompleteIntent += flags.incompleteIntent ? 1 : 0;
  }

  for (const duplicateId of duplicateIds) {
    pushIssue(issues, "error", "duplicate_label_id", duplicateId, "Label ID appears more than once.");
  }

  for (const warning of detectAggregatedBarDiscontinuities(db).filter(
    (dataQualityWarning) => dataQualityWarning.severity === "warning"
  )) {
    pushIssue(
      issues,
      "warning",
      "data_quality_large_price_discontinuity",
      null,
      warning.message
    );
  }

  summary.errorCount = issues.filter((issue) => issue.severity === "error").length;
  summary.warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return {
    status: summary.errorCount > 0 ? "fail" : summary.warningCount > 0 ? "warning" : "pass",
    summary,
    issues
  };
}
