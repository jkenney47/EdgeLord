import { nanoid } from "nanoid";
import { z } from "zod";

import { recordAudit } from "../audit/auditService.js";
import type { SqliteDatabase } from "../db/database.js";
import { outcomeRuleVersion } from "../outcomes/outcomeVersions.js";

const labelTypeSchema = z.enum(["ENTRY", "EXIT", "SKIP", "INVALID"]);
const decisionPhaseSchema = z.enum(["at_close", "at_open", "intrabar"]);
const captureModeSchema = z.enum(["regular", "replay"]);
const decisionRoleSchema = z.enum(["setup_start", "trigger", "entry", "management", "exit", "skip", "invalid"]);
const biasSchema = z.enum(["long", "short", "neutral", "unclear"]);
const marketBiasSchema = z.enum(["bullish_semis", "bearish_semis", "neutral", "unclear"]);
const tradeDirectionSchema = z.enum(["long_ticker", "short_ticker", "observe_only"]);
const instrumentRoleSchema = z.enum(["primary", "inverse_pair", "confirmation"]);
const pairedTickerRoleSchema = z.enum(["confirmation", "divergence", "ignored", "inverse_signal"]);
const outcomeStatusSchema = z.enum([
  "not_computed",
  "pending",
  "computed",
  "insufficient_future_bars",
  "missing_exit",
  "invalidated"
]);
const reasonCodeSchema = z.enum([
  "trendline_break",
  "stoch_rsi_condition",
  "ema_alignment",
  "volatility_expansion",
  "inverse_etf_confirmation",
  "other"
]);

const createTradeEventSchema = z.object({
  sessionId: z.string().min(1),
  timestamp: z.string().min(1),
  ticker: z.string().min(1),
  timeframe: z.string().min(1),
  labelType: labelTypeSchema,
  price: z.number(),
  confidence: z.number().int().min(1).max(5),
  setupQuality: z.number().int().min(1).max(5),
  reasonCodes: z.array(reasonCodeSchema),
  notes: z.string().nullable().optional(),
  decisionPhase: decisionPhaseSchema.default("at_close"),
  captureMode: captureModeSchema.default("regular"),
  visibleUntilTimestamp: z.string().min(1).nullable().optional(),
  potentialVisualLeakage: z.boolean().default(false),
  selectedBarIndex: z.number().int().min(0).nullable().optional(),
  setupId: z.string().min(1).nullable().optional(),
  tradeId: z.string().min(1).nullable().optional(),
  parentLabelId: z.string().min(1).nullable().optional(),
  decisionRole: decisionRoleSchema.optional(),
  bias: biasSchema.default("unclear"),
  marketBias: marketBiasSchema.default("unclear"),
  tradeDirection: tradeDirectionSchema.default("observe_only"),
  instrumentRole: instrumentRoleSchema.default("primary"),
  pairedTickerRole: pairedTickerRoleSchema.default("ignored"),
  entryStyle: z.string().min(1).nullable().optional(),
  exitStyle: z.string().min(1).nullable().optional(),
  invalidationPrice: z.number().nullable().optional(),
  targetPrice: z.number().nullable().optional(),
  outcomeAvailable: z.boolean().default(false),
  outcomeHorizonBars: z.number().int().min(1).nullable().optional(),
  outcomeFutureReturn1: z.number().nullable().optional(),
  outcomeFutureReturn3: z.number().nullable().optional(),
  outcomeFutureReturn5: z.number().nullable().optional(),
  outcomeFutureReturn10: z.number().nullable().optional(),
  outcomeFutureMaxFavorableExcursion: z.number().nullable().optional(),
  outcomeFutureMaxAdverseExcursion: z.number().nullable().optional(),
  outcomeFutureHitTarget: z.boolean().nullable().optional(),
  outcomeFutureHitStop: z.boolean().nullable().optional(),
  outcomeFutureBarsToTarget: z.number().int().min(0).nullable().optional(),
  outcomeFutureBarsToStop: z.number().int().min(0).nullable().optional(),
  outcomeStatus: outcomeStatusSchema.default("not_computed"),
  outcomeRuleVersion: z.string().min(1).nullable().optional(),
  multiTimeframeContext: z.unknown().optional(),
  indicatorSnapshot: z.unknown(),
  structureSnapshot: z.unknown(),
  drawingContext: z.unknown()
});

const updateTradeEventSchema = createTradeEventSchema.partial().omit({
  sessionId: true
});

export type TradeEventInput = z.input<typeof createTradeEventSchema>;
export type TradeEventUpdateInput = z.input<typeof updateTradeEventSchema>;

type TradeEventRow = {
  id: string;
  session_id: string;
  timestamp: string;
  ticker: string;
  timeframe: string;
  label_type: "ENTRY" | "EXIT" | "SKIP" | "INVALID";
  price: number;
  confidence: number;
  setup_quality: number;
  reason_codes_json: string;
  notes: string | null;
  decision_phase: "at_close" | "at_open" | "intrabar" | null;
  capture_mode: "regular" | "replay" | null;
  visible_until_timestamp: string | null;
  potential_visual_leakage: number | null;
  selected_bar_index: number | null;
  setup_id: string | null;
  trade_id: string | null;
  parent_label_id: string | null;
  decision_role: "setup_start" | "trigger" | "entry" | "management" | "exit" | "skip" | "invalid" | null;
  bias: "long" | "short" | "neutral" | "unclear" | null;
  market_bias: "bullish_semis" | "bearish_semis" | "neutral" | "unclear" | null;
  trade_direction: "long_ticker" | "short_ticker" | "observe_only" | null;
  instrument_role: "primary" | "inverse_pair" | "confirmation" | null;
  paired_ticker_role: "confirmation" | "divergence" | "ignored" | "inverse_signal" | null;
  entry_style: string | null;
  exit_style: string | null;
  invalidation_price: number | null;
  target_price: number | null;
  outcome_available: number | null;
  outcome_horizon_bars: number | null;
  outcome_future_return_1: number | null;
  outcome_future_return_3: number | null;
  outcome_future_return_5: number | null;
  outcome_future_return_10: number | null;
  outcome_future_max_favorable_excursion: number | null;
  outcome_future_max_adverse_excursion: number | null;
  outcome_future_hit_target: number | null;
  outcome_future_hit_stop: number | null;
  outcome_future_bars_to_target: number | null;
  outcome_future_bars_to_stop: number | null;
  outcome_status:
    | "not_computed"
    | "pending"
    | "computed"
    | "insufficient_future_bars"
    | "missing_exit"
    | "invalidated"
    | null;
  outcome_rule_version: string | null;
  multi_timeframe_context_json: string | null;
  indicator_snapshot_json: string;
  structure_snapshot_json: string;
  drawing_context_json: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type TradeEventDto = {
  id: string;
  sessionId: string;
  timestamp: string;
  ticker: string;
  timeframe: string;
  labelType: "ENTRY" | "EXIT" | "SKIP" | "INVALID";
  price: number;
  confidence: number;
  setupQuality: number;
  reasonCodes: string[];
  notes: string | null;
  decisionPhase: "at_close" | "at_open" | "intrabar";
  captureMode: "regular" | "replay";
  visibleUntilTimestamp: string;
  potentialVisualLeakage: boolean;
  selectedBarIndex: number | null;
  setupId: string | null;
  tradeId: string | null;
  parentLabelId: string | null;
  decisionRole: "setup_start" | "trigger" | "entry" | "management" | "exit" | "skip" | "invalid";
  bias: "long" | "short" | "neutral" | "unclear";
  marketBias: "bullish_semis" | "bearish_semis" | "neutral" | "unclear";
  tradeDirection: "long_ticker" | "short_ticker" | "observe_only";
  instrumentRole: "primary" | "inverse_pair" | "confirmation";
  pairedTickerRole: "confirmation" | "divergence" | "ignored" | "inverse_signal";
  entryStyle: string | null;
  exitStyle: string | null;
  invalidationPrice: number | null;
  targetPrice: number | null;
  outcomeAvailable: boolean;
  outcomeHorizonBars: number | null;
  outcomeFutureReturn1: number | null;
  outcomeFutureReturn3: number | null;
  outcomeFutureReturn5: number | null;
  outcomeFutureReturn10: number | null;
  outcomeFutureMaxFavorableExcursion: number | null;
  outcomeFutureMaxAdverseExcursion: number | null;
  outcomeFutureHitTarget: boolean | null;
  outcomeFutureHitStop: boolean | null;
  outcomeFutureBarsToTarget: number | null;
  outcomeFutureBarsToStop: number | null;
  outcomeStatus:
    | "not_computed"
    | "pending"
    | "computed"
    | "insufficient_future_bars"
    | "missing_exit"
    | "invalidated";
  outcomeRuleVersion: string | null;
  multiTimeframeContext: unknown;
  indicatorSnapshot: unknown;
  structureSnapshot: unknown;
  drawingContext: unknown;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function defaultDecisionRole(labelType: TradeEventDto["labelType"]): TradeEventDto["decisionRole"] {
  if (labelType === "ENTRY") {
    return "entry";
  }
  if (labelType === "EXIT") {
    return "exit";
  }
  if (labelType === "SKIP") {
    return "skip";
  }
  return "invalid";
}

function defaultOutcomeStatus(row: Pick<TradeEventRow, "outcome_available" | "outcome_status">): TradeEventDto["outcomeStatus"] {
  if (row.outcome_status) {
    return row.outcome_status;
  }

  return row.outcome_available === 1 ? "computed" : "not_computed";
}

function normalizedOutcomeStatus(
  outcomeAvailable: boolean,
  status: TradeEventDto["outcomeStatus"]
): TradeEventDto["outcomeStatus"] {
  return outcomeAvailable && status === "not_computed" ? "computed" : status;
}

function rowToDto(row: TradeEventRow): TradeEventDto {
  const labelType = row.label_type;

  return {
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp,
    ticker: row.ticker,
    timeframe: row.timeframe,
    labelType,
    price: row.price,
    confidence: row.confidence,
    setupQuality: row.setup_quality,
    reasonCodes: parseJson(row.reason_codes_json) as string[],
    notes: row.notes,
    decisionPhase: row.decision_phase ?? "at_close",
    captureMode: row.capture_mode ?? "regular",
    visibleUntilTimestamp: row.visible_until_timestamp ?? row.timestamp,
    potentialVisualLeakage: row.potential_visual_leakage === 1,
    selectedBarIndex: row.selected_bar_index,
    setupId: row.setup_id,
    tradeId: row.trade_id,
    parentLabelId: row.parent_label_id,
    decisionRole: row.decision_role ?? defaultDecisionRole(labelType),
    bias: row.bias ?? "unclear",
    marketBias: row.market_bias ?? "unclear",
    tradeDirection: row.trade_direction ?? "observe_only",
    instrumentRole: row.instrument_role ?? "primary",
    pairedTickerRole: row.paired_ticker_role ?? "ignored",
    entryStyle: row.entry_style,
    exitStyle: row.exit_style,
    invalidationPrice: row.invalidation_price,
    targetPrice: row.target_price,
    outcomeAvailable: row.outcome_available === 1,
    outcomeHorizonBars: row.outcome_horizon_bars,
    outcomeFutureReturn1: row.outcome_future_return_1,
    outcomeFutureReturn3: row.outcome_future_return_3,
    outcomeFutureReturn5: row.outcome_future_return_5,
    outcomeFutureReturn10: row.outcome_future_return_10,
    outcomeFutureMaxFavorableExcursion: row.outcome_future_max_favorable_excursion,
    outcomeFutureMaxAdverseExcursion: row.outcome_future_max_adverse_excursion,
    outcomeFutureHitTarget:
      row.outcome_future_hit_target === null ? null : row.outcome_future_hit_target === 1,
    outcomeFutureHitStop:
      row.outcome_future_hit_stop === null ? null : row.outcome_future_hit_stop === 1,
    outcomeFutureBarsToTarget: row.outcome_future_bars_to_target,
    outcomeFutureBarsToStop: row.outcome_future_bars_to_stop,
    outcomeStatus: defaultOutcomeStatus(row),
    outcomeRuleVersion: row.outcome_rule_version,
    multiTimeframeContext: row.multi_timeframe_context_json ? parseJson(row.multi_timeframe_context_json) : {},
    indicatorSnapshot: parseJson(row.indicator_snapshot_json),
    structureSnapshot: parseJson(row.structure_snapshot_json),
    drawingContext: parseJson(row.drawing_context_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  };
}

function getTradeEventRow(db: SqliteDatabase, id: string): TradeEventRow | null {
  return (
    (db.prepare("select * from trade_events where id = ?").get(id) as TradeEventRow | undefined) ??
    null
  );
}

function getTradeEvent(db: SqliteDatabase, id: string): TradeEventDto | null {
  const row = getTradeEventRow(db, id);
  return row ? rowToDto(row) : null;
}

function assertSessionExists(db: SqliteDatabase, sessionId: string): void {
  const row = db.prepare("select id from sessions where id = ?").get(sessionId);

  if (!row) {
    throw new Error("Session not found");
  }
}

export function createTradeEvent(db: SqliteDatabase, input: TradeEventInput): TradeEventDto {
  const parsed = createTradeEventSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("Invalid trade event");
  }

  assertSessionExists(db, parsed.data.sessionId);

  const id = nanoid();
  const now = new Date().toISOString();
  const outcomeStatus = normalizedOutcomeStatus(parsed.data.outcomeAvailable, parsed.data.outcomeStatus);
  const outcomeRule = parsed.data.outcomeRuleVersion ?? (parsed.data.outcomeAvailable ? outcomeRuleVersion : null);

  db.prepare(
    `insert into trade_events (
      id,
      session_id,
      timestamp,
      ticker,
      timeframe,
      label_type,
      price,
      confidence,
      setup_quality,
      reason_codes_json,
      notes,
      decision_phase,
      capture_mode,
      visible_until_timestamp,
      potential_visual_leakage,
      selected_bar_index,
      setup_id,
      trade_id,
      parent_label_id,
      decision_role,
      bias,
      market_bias,
      trade_direction,
      instrument_role,
      paired_ticker_role,
      entry_style,
      exit_style,
      invalidation_price,
      target_price,
      outcome_available,
      outcome_horizon_bars,
      outcome_future_return_1,
      outcome_future_return_3,
      outcome_future_return_5,
      outcome_future_return_10,
      outcome_future_max_favorable_excursion,
      outcome_future_max_adverse_excursion,
      outcome_future_hit_target,
      outcome_future_hit_stop,
      outcome_future_bars_to_target,
      outcome_future_bars_to_stop,
      outcome_status,
      outcome_rule_version,
      multi_timeframe_context_json,
      indicator_snapshot_json,
      structure_snapshot_json,
      drawing_context_json,
      created_at,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    parsed.data.sessionId,
    parsed.data.timestamp,
    parsed.data.ticker,
    parsed.data.timeframe,
    parsed.data.labelType,
    parsed.data.price,
    parsed.data.confidence,
    parsed.data.setupQuality,
    JSON.stringify(parsed.data.reasonCodes),
    parsed.data.notes ?? null,
    parsed.data.decisionPhase,
    parsed.data.captureMode,
    parsed.data.visibleUntilTimestamp ?? parsed.data.timestamp,
    parsed.data.potentialVisualLeakage ? 1 : 0,
    parsed.data.selectedBarIndex ?? null,
    parsed.data.setupId ?? null,
    parsed.data.tradeId ?? null,
    parsed.data.parentLabelId ?? null,
    parsed.data.decisionRole ?? defaultDecisionRole(parsed.data.labelType),
    parsed.data.bias,
    parsed.data.marketBias,
    parsed.data.tradeDirection,
    parsed.data.instrumentRole,
    parsed.data.pairedTickerRole,
    parsed.data.entryStyle ?? null,
    parsed.data.exitStyle ?? null,
    parsed.data.invalidationPrice ?? null,
    parsed.data.targetPrice ?? null,
    parsed.data.outcomeAvailable ? 1 : 0,
    parsed.data.outcomeHorizonBars ?? null,
    parsed.data.outcomeFutureReturn1 ?? null,
    parsed.data.outcomeFutureReturn3 ?? null,
    parsed.data.outcomeFutureReturn5 ?? null,
    parsed.data.outcomeFutureReturn10 ?? null,
    parsed.data.outcomeFutureMaxFavorableExcursion ?? null,
    parsed.data.outcomeFutureMaxAdverseExcursion ?? null,
    parsed.data.outcomeFutureHitTarget === undefined || parsed.data.outcomeFutureHitTarget === null
      ? null
      : parsed.data.outcomeFutureHitTarget
        ? 1
        : 0,
    parsed.data.outcomeFutureHitStop === undefined || parsed.data.outcomeFutureHitStop === null
      ? null
      : parsed.data.outcomeFutureHitStop
        ? 1
        : 0,
    parsed.data.outcomeFutureBarsToTarget ?? null,
    parsed.data.outcomeFutureBarsToStop ?? null,
    outcomeStatus,
    outcomeRule,
    JSON.stringify(parsed.data.multiTimeframeContext ?? {}),
    JSON.stringify(parsed.data.indicatorSnapshot),
    JSON.stringify(parsed.data.structureSnapshot),
    JSON.stringify(parsed.data.drawingContext),
    now,
    now
  );

  const created = getTradeEvent(db, id);
  if (!created) {
    throw new Error("Trade event create failed");
  }

  recordAudit(db, {
    entityType: "trade_event",
    entityId: id,
    action: "create",
    before: null,
    after: created
  });

  return created;
}

export function updateTradeEvent(
  db: SqliteDatabase,
  id: string,
  input: TradeEventUpdateInput
): TradeEventDto {
  const parsed = updateTradeEventSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("Invalid trade event");
  }

  const before = getTradeEvent(db, id);
  if (!before) {
    throw new Error("Trade event not found");
  }

  const merged = {
    ...before,
    ...parsed.data,
    notes: parsed.data.notes === undefined ? before.notes : parsed.data.notes,
    reasonCodes: parsed.data.reasonCodes ?? before.reasonCodes,
    decisionPhase: parsed.data.decisionPhase ?? before.decisionPhase,
    captureMode: parsed.data.captureMode ?? before.captureMode,
    visibleUntilTimestamp:
      parsed.data.visibleUntilTimestamp === undefined
        ? before.visibleUntilTimestamp
        : (parsed.data.visibleUntilTimestamp ?? before.timestamp),
    potentialVisualLeakage: parsed.data.potentialVisualLeakage ?? before.potentialVisualLeakage,
    selectedBarIndex:
      parsed.data.selectedBarIndex === undefined ? before.selectedBarIndex : parsed.data.selectedBarIndex,
    setupId: parsed.data.setupId === undefined ? before.setupId : parsed.data.setupId,
    tradeId: parsed.data.tradeId === undefined ? before.tradeId : parsed.data.tradeId,
    parentLabelId:
      parsed.data.parentLabelId === undefined ? before.parentLabelId : parsed.data.parentLabelId,
    decisionRole: parsed.data.decisionRole ?? before.decisionRole,
    bias: parsed.data.bias ?? before.bias,
    marketBias: parsed.data.marketBias ?? before.marketBias,
    tradeDirection: parsed.data.tradeDirection ?? before.tradeDirection,
    instrumentRole: parsed.data.instrumentRole ?? before.instrumentRole,
    pairedTickerRole: parsed.data.pairedTickerRole ?? before.pairedTickerRole,
    entryStyle: parsed.data.entryStyle === undefined ? before.entryStyle : parsed.data.entryStyle,
    exitStyle: parsed.data.exitStyle === undefined ? before.exitStyle : parsed.data.exitStyle,
    invalidationPrice:
      parsed.data.invalidationPrice === undefined ? before.invalidationPrice : parsed.data.invalidationPrice,
    targetPrice: parsed.data.targetPrice === undefined ? before.targetPrice : parsed.data.targetPrice,
    outcomeAvailable: parsed.data.outcomeAvailable ?? before.outcomeAvailable,
    outcomeHorizonBars:
      parsed.data.outcomeHorizonBars === undefined ? before.outcomeHorizonBars : parsed.data.outcomeHorizonBars,
    outcomeFutureReturn1:
      parsed.data.outcomeFutureReturn1 === undefined ? before.outcomeFutureReturn1 : parsed.data.outcomeFutureReturn1,
    outcomeFutureReturn3:
      parsed.data.outcomeFutureReturn3 === undefined ? before.outcomeFutureReturn3 : parsed.data.outcomeFutureReturn3,
    outcomeFutureReturn5:
      parsed.data.outcomeFutureReturn5 === undefined ? before.outcomeFutureReturn5 : parsed.data.outcomeFutureReturn5,
    outcomeFutureReturn10:
      parsed.data.outcomeFutureReturn10 === undefined
        ? before.outcomeFutureReturn10
        : parsed.data.outcomeFutureReturn10,
    outcomeFutureMaxFavorableExcursion:
      parsed.data.outcomeFutureMaxFavorableExcursion === undefined
        ? before.outcomeFutureMaxFavorableExcursion
        : parsed.data.outcomeFutureMaxFavorableExcursion,
    outcomeFutureMaxAdverseExcursion:
      parsed.data.outcomeFutureMaxAdverseExcursion === undefined
        ? before.outcomeFutureMaxAdverseExcursion
        : parsed.data.outcomeFutureMaxAdverseExcursion,
    outcomeFutureHitTarget:
      parsed.data.outcomeFutureHitTarget === undefined
        ? before.outcomeFutureHitTarget
        : parsed.data.outcomeFutureHitTarget,
    outcomeFutureHitStop:
      parsed.data.outcomeFutureHitStop === undefined
        ? before.outcomeFutureHitStop
        : parsed.data.outcomeFutureHitStop,
    outcomeFutureBarsToTarget:
      parsed.data.outcomeFutureBarsToTarget === undefined
        ? before.outcomeFutureBarsToTarget
        : parsed.data.outcomeFutureBarsToTarget,
    outcomeFutureBarsToStop:
      parsed.data.outcomeFutureBarsToStop === undefined
        ? before.outcomeFutureBarsToStop
        : parsed.data.outcomeFutureBarsToStop,
    outcomeStatus:
      parsed.data.outcomeStatus ??
      (parsed.data.outcomeAvailable === true
        ? normalizedOutcomeStatus(true, before.outcomeStatus)
        : before.outcomeStatus),
    outcomeRuleVersion:
      parsed.data.outcomeRuleVersion === undefined
        ? parsed.data.outcomeAvailable === true
          ? (before.outcomeRuleVersion ?? outcomeRuleVersion)
          : before.outcomeRuleVersion
        : parsed.data.outcomeRuleVersion,
    multiTimeframeContext: parsed.data.multiTimeframeContext ?? before.multiTimeframeContext,
    indicatorSnapshot: parsed.data.indicatorSnapshot ?? before.indicatorSnapshot,
    structureSnapshot: parsed.data.structureSnapshot ?? before.structureSnapshot,
    drawingContext: parsed.data.drawingContext ?? before.drawingContext
  };
  const now = new Date().toISOString();

  db.prepare(
    `update trade_events set
      timestamp = ?,
      ticker = ?,
      timeframe = ?,
      label_type = ?,
      price = ?,
      confidence = ?,
      setup_quality = ?,
      reason_codes_json = ?,
      notes = ?,
      decision_phase = ?,
      capture_mode = ?,
      visible_until_timestamp = ?,
      potential_visual_leakage = ?,
      selected_bar_index = ?,
      setup_id = ?,
      trade_id = ?,
      parent_label_id = ?,
      decision_role = ?,
      bias = ?,
      market_bias = ?,
      trade_direction = ?,
      instrument_role = ?,
      paired_ticker_role = ?,
      entry_style = ?,
      exit_style = ?,
      invalidation_price = ?,
      target_price = ?,
      outcome_available = ?,
      outcome_horizon_bars = ?,
      outcome_future_return_1 = ?,
      outcome_future_return_3 = ?,
      outcome_future_return_5 = ?,
      outcome_future_return_10 = ?,
      outcome_future_max_favorable_excursion = ?,
      outcome_future_max_adverse_excursion = ?,
      outcome_future_hit_target = ?,
      outcome_future_hit_stop = ?,
      outcome_future_bars_to_target = ?,
      outcome_future_bars_to_stop = ?,
      outcome_status = ?,
      outcome_rule_version = ?,
      multi_timeframe_context_json = ?,
      indicator_snapshot_json = ?,
      structure_snapshot_json = ?,
      drawing_context_json = ?,
      updated_at = ?
    where id = ?`
  ).run(
    merged.timestamp,
    merged.ticker,
    merged.timeframe,
    merged.labelType,
    merged.price,
    merged.confidence,
    merged.setupQuality,
    JSON.stringify(merged.reasonCodes),
    merged.notes,
    merged.decisionPhase,
    merged.captureMode,
    merged.visibleUntilTimestamp,
    merged.potentialVisualLeakage ? 1 : 0,
    merged.selectedBarIndex,
    merged.setupId,
    merged.tradeId,
    merged.parentLabelId,
    merged.decisionRole,
    merged.bias,
    merged.marketBias,
    merged.tradeDirection,
    merged.instrumentRole,
    merged.pairedTickerRole,
    merged.entryStyle,
    merged.exitStyle,
    merged.invalidationPrice,
    merged.targetPrice,
    merged.outcomeAvailable ? 1 : 0,
    merged.outcomeHorizonBars,
    merged.outcomeFutureReturn1,
    merged.outcomeFutureReturn3,
    merged.outcomeFutureReturn5,
    merged.outcomeFutureReturn10,
    merged.outcomeFutureMaxFavorableExcursion,
    merged.outcomeFutureMaxAdverseExcursion,
    merged.outcomeFutureHitTarget === null ? null : merged.outcomeFutureHitTarget ? 1 : 0,
    merged.outcomeFutureHitStop === null ? null : merged.outcomeFutureHitStop ? 1 : 0,
    merged.outcomeFutureBarsToTarget,
    merged.outcomeFutureBarsToStop,
    merged.outcomeStatus,
    merged.outcomeRuleVersion,
    JSON.stringify(merged.multiTimeframeContext),
    JSON.stringify(merged.indicatorSnapshot),
    JSON.stringify(merged.structureSnapshot),
    JSON.stringify(merged.drawingContext),
    now,
    id
  );

  const after = getTradeEvent(db, id);
  if (!after) {
    throw new Error("Trade event update failed");
  }

  recordAudit(db, {
    entityType: "trade_event",
    entityId: id,
    action: "update",
    before,
    after
  });

  return after;
}

export function deleteTradeEvent(db: SqliteDatabase, id: string): TradeEventDto {
  const before = getTradeEvent(db, id);
  if (!before) {
    throw new Error("Trade event not found");
  }

  const now = new Date().toISOString();
  db.prepare("update trade_events set deleted_at = ?, updated_at = ? where id = ?").run(now, now, id);

  const after = getTradeEvent(db, id);
  if (!after) {
    throw new Error("Trade event delete failed");
  }

  recordAudit(db, {
    entityType: "trade_event",
    entityId: id,
    action: "delete",
    before,
    after
  });

  return after;
}

export function listTradeEventsForSession(db: SqliteDatabase, sessionId: string): TradeEventDto[] {
  const rows = db
    .prepare(
      `select *
      from trade_events
      where session_id = ? and deleted_at is null
      order by timestamp asc, created_at asc`
    )
    .all(sessionId) as TradeEventRow[];

  return rows.map(rowToDto);
}

export function listTradeEvents(db: SqliteDatabase, filters: { sessionId?: string } = {}): TradeEventDto[] {
  const where = ["deleted_at is null"];
  const values: unknown[] = [];

  if (filters.sessionId) {
    where.push("session_id = ?");
    values.push(filters.sessionId);
  }

  const rows = db
    .prepare(
      `select *
      from trade_events
      where ${where.join(" and ")}
      order by timestamp asc, created_at asc`
    )
    .all(...values) as TradeEventRow[];

  return rows.map(rowToDto);
}
