import { nanoid } from "nanoid";
import { z } from "zod";

import { getBarIndex } from "./bars";
import { db, nowIso } from "./db";
import { buildFeatures } from "./indicators";
import type { CaptureMode, Label, LabelSource } from "./schema";
import { canEnter, canExit, closeTrade, createTrade, getOpenTrade, rebuildTrades } from "./trades";

export const createLabelSchema = z.object({
  labelSource: z.enum(["actual_trade", "retrospective_replay", "retrospective_hindsight"]),
  action: z.enum(["ENTRY", "EXIT", "SKIP", "INVALID"]),
  ticker: z.enum(["SOXL", "SOXS"]),
  timeframe: z.enum(["1D", "4H", "2H"]),
  timestamp: z.string(),
  chartPrice: z.number(),
  executionPrice: z.number().nullable().optional(),
  captureMode: z.enum(["replay", "regular"]),
  visibleUntilTimestamp: z.string().optional(),
  potentialVisualLeakage: z.boolean().optional(),
  confidence: z.number().int().min(1).max(5).nullable().optional(),
  setupQuality: z.number().int().min(1).max(5).nullable().optional(),
  reasonCodes: z.array(z.string()).optional(),
  notes: z.string().nullable().optional()
});

export const patchLabelSchema = createLabelSchema.partial();

function trainingEligible(labelSource: LabelSource, captureMode: CaptureMode, leakage: boolean): boolean {
  if (leakage) return false;
  return labelSource === "actual_trade" || (labelSource === "retrospective_replay" && captureMode === "replay");
}

export function getLabels(): Label[] {
  return db.prepare("select * from labels where deleted_at is null order by created_at asc").all() as Label[];
}

export function getActiveLabelCount(): number {
  const row = db.prepare("select count(*) as count from labels where deleted_at is null").get() as { count: number };
  return row.count;
}

export function getLabel(id: string): Label | null {
  return db.prepare("select * from labels where id = ? and deleted_at is null").get(id) as Label | undefined ?? null;
}

export function createLabel(input: z.infer<typeof createLabelSchema>): { label: Label; openTrade: ReturnType<typeof getOpenTrade> } {
  if (input.action === "ENTRY") {
    const allowed = canEnter(input.ticker);
    if (!allowed.ok) throw new Error(allowed.reason);
  }

  if (input.action === "EXIT") {
    const allowed = canExit(input.ticker);
    if (!allowed.ok) throw new Error(allowed.reason);
  }

  const now = nowIso();
  const openTrade = getOpenTrade();
  const tradeId = input.action === "ENTRY"
    ? `trade-${nanoid(10)}`
    : input.action === "EXIT"
      ? openTrade?.id ?? null
      : null;
  const parentEntryLabelId = input.action === "EXIT" ? openTrade?.entry_label_id ?? null : null;
  const leakage = input.potentialVisualLeakage ?? (input.captureMode === "regular" && input.labelSource !== "actual_trade");
  const features = buildFeatures(input.ticker, input.timeframe, input.timestamp);
  const label: Label = {
    id: `label-${nanoid(12)}`,
    label_source: input.labelSource,
    training_eligible: trainingEligible(input.labelSource, input.captureMode, leakage) ? 1 : 0,
    action: input.action,
    ticker: input.ticker,
    timeframe: input.timeframe,
    timestamp: input.timestamp,
    bar_index: getBarIndex(input.ticker, input.timeframe, input.timestamp),
    chart_price: input.chartPrice,
    execution_price: input.executionPrice ?? null,
    trade_id: tradeId,
    parent_entry_label_id: parentEntryLabelId,
    capture_mode: input.captureMode,
    visible_until_timestamp: input.visibleUntilTimestamp ?? input.timestamp,
    potential_visual_leakage: leakage ? 1 : 0,
    confidence: input.confidence ?? null,
    setup_quality: input.setupQuality ?? null,
    reason_codes_json: JSON.stringify(input.reasonCodes ?? []),
    notes: input.notes ?? null,
    features_json: JSON.stringify(features),
    created_at: now,
    updated_at: now,
    deleted_at: null
  };

  db.prepare(`
    insert into labels (
      id, label_source, training_eligible, action, ticker, timeframe, timestamp, bar_index, chart_price, execution_price,
      trade_id, parent_entry_label_id, capture_mode, visible_until_timestamp, potential_visual_leakage, confidence,
      setup_quality, reason_codes_json, notes, features_json, created_at, updated_at, deleted_at
    )
    values (
      @id, @label_source, @training_eligible, @action, @ticker, @timeframe, @timestamp, @bar_index, @chart_price, @execution_price,
      @trade_id, @parent_entry_label_id, @capture_mode, @visible_until_timestamp, @potential_visual_leakage, @confidence,
      @setup_quality, @reason_codes_json, @notes, @features_json, @created_at, @updated_at, @deleted_at
    )
  `).run(label);

  if (label.action === "ENTRY") createTrade(label);
  if (label.action === "EXIT") closeTrade(label);

  return { label, openTrade: getOpenTrade() };
}

export function patchLabel(id: string, patch: z.infer<typeof patchLabelSchema>): Label {
  const existing = getLabel(id);
  if (!existing) throw new Error("Label not found");
  const next = {
    ...existing,
    label_source: patch.labelSource ?? existing.label_source,
    action: patch.action ?? existing.action,
    ticker: patch.ticker ?? existing.ticker,
    timeframe: patch.timeframe ?? existing.timeframe,
    timestamp: patch.timestamp ?? existing.timestamp,
    chart_price: patch.chartPrice ?? existing.chart_price,
    execution_price: patch.executionPrice ?? existing.execution_price,
    capture_mode: patch.captureMode ?? existing.capture_mode,
    visible_until_timestamp: patch.visibleUntilTimestamp ?? existing.visible_until_timestamp,
    potential_visual_leakage: (patch.potentialVisualLeakage ?? Boolean(existing.potential_visual_leakage)) ? 1 : 0,
    confidence: patch.confidence ?? existing.confidence,
    setup_quality: patch.setupQuality ?? existing.setup_quality,
    reason_codes_json: patch.reasonCodes ? JSON.stringify(patch.reasonCodes) : existing.reason_codes_json,
    notes: patch.notes ?? existing.notes,
    updated_at: nowIso()
  };
  next.training_eligible = trainingEligible(next.label_source, next.capture_mode, Boolean(next.potential_visual_leakage)) ? 1 : 0;
  next.bar_index = getBarIndex(next.ticker, next.timeframe, next.timestamp);
  next.features_json = JSON.stringify(buildFeatures(next.ticker, next.timeframe, next.timestamp));

  db.prepare(`
    update labels set
      label_source = @label_source,
      training_eligible = @training_eligible,
      action = @action,
      ticker = @ticker,
      timeframe = @timeframe,
      timestamp = @timestamp,
      bar_index = @bar_index,
      chart_price = @chart_price,
      execution_price = @execution_price,
      capture_mode = @capture_mode,
      visible_until_timestamp = @visible_until_timestamp,
      potential_visual_leakage = @potential_visual_leakage,
      confidence = @confidence,
      setup_quality = @setup_quality,
      reason_codes_json = @reason_codes_json,
      notes = @notes,
      features_json = @features_json,
      updated_at = @updated_at
    where id = @id
  `).run(next);
  rebuildTrades(getLabels());
  return getLabel(id) as Label;
}

export function deleteLabel(id: string): void {
  db.prepare("update labels set deleted_at = ?, updated_at = ? where id = ?").run(nowIso(), nowIso(), id);
  rebuildTrades(getLabels());
}
