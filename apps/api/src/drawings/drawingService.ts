import { nanoid } from "nanoid";
import { z } from "zod";

import { recordAudit } from "../audit/auditService.js";
import type { SqliteDatabase } from "../db/database.js";

const drawingAnchorSchema = z.object({
  timestamp: z.string().min(1),
  price: z.number()
});

const drawingTypeSchema = z.enum(["trendline", "horizontal_level", "breakout_marker"]);

const createDrawingSchema = z.object({
  sessionId: z.string().min(1).nullable().optional(),
  ticker: z.string().min(1),
  timeframe: z.string().min(1),
  type: drawingTypeSchema,
  anchors: z.array(drawingAnchorSchema).min(1),
  style: z.unknown().nullable().optional()
});

const updateDrawingSchema = createDrawingSchema.partial().omit({
  sessionId: true
});

export type DrawingInput = z.input<typeof createDrawingSchema>;
export type DrawingUpdateInput = z.input<typeof updateDrawingSchema>;

type DrawingRow = {
  id: string;
  session_id: string | null;
  ticker: string;
  timeframe: string;
  type: "trendline" | "horizontal_level" | "breakout_marker";
  anchors_json: string;
  style_json: string | null;
  slope: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type DrawingDto = {
  id: string;
  sessionId: string | null;
  ticker: string;
  timeframe: string;
  type: "trendline" | "horizontal_level" | "breakout_marker";
  anchors: Array<{ timestamp: string; price: number }>;
  style: unknown | null;
  slope: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type DrawingListFilters = {
  ticker?: string;
  timeframe?: string;
  sessionId?: string | null;
};

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function rowToDto(row: DrawingRow): DrawingDto {
  return {
    id: row.id,
    sessionId: row.session_id,
    ticker: row.ticker,
    timeframe: row.timeframe,
    type: row.type,
    anchors: parseJson(row.anchors_json) as DrawingDto["anchors"],
    style: row.style_json ? parseJson(row.style_json) : null,
    slope: row.slope,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  };
}

function getDrawingRow(db: SqliteDatabase, id: string): DrawingRow | null {
  return (db.prepare("select * from drawings where id = ?").get(id) as DrawingRow | undefined) ?? null;
}

function getDrawing(db: SqliteDatabase, id: string): DrawingDto | null {
  const row = getDrawingRow(db, id);
  return row ? rowToDto(row) : null;
}

function computeSlope(anchors: DrawingDto["anchors"]): number | null {
  if (anchors.length < 2) {
    return null;
  }

  const [start, end] = anchors;
  const startTime = new Date(start.timestamp).getTime();
  const endTime = new Date(end.timestamp).getTime();

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime === startTime) {
    return null;
  }

  return (end.price - start.price) / (endTime - startTime);
}

export function createDrawing(db: SqliteDatabase, input: DrawingInput): DrawingDto {
  const parsed = createDrawingSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("Invalid drawing");
  }

  const id = nanoid();
  const now = new Date().toISOString();
  const slope = computeSlope(parsed.data.anchors);

  db.prepare(
    `insert into drawings (
      id,
      session_id,
      ticker,
      timeframe,
      type,
      anchors_json,
      style_json,
      slope,
      created_at,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    parsed.data.sessionId ?? null,
    parsed.data.ticker,
    parsed.data.timeframe,
    parsed.data.type,
    JSON.stringify(parsed.data.anchors),
    parsed.data.style === undefined || parsed.data.style === null ? null : JSON.stringify(parsed.data.style),
    slope,
    now,
    now
  );

  const created = getDrawing(db, id);
  if (!created) {
    throw new Error("Drawing create failed");
  }

  recordAudit(db, {
    entityType: "drawing",
    entityId: id,
    action: "create",
    before: null,
    after: created
  });

  return created;
}

export function updateDrawing(db: SqliteDatabase, id: string, input: DrawingUpdateInput): DrawingDto {
  const parsed = updateDrawingSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("Invalid drawing");
  }

  const before = getDrawing(db, id);
  if (!before) {
    throw new Error("Drawing not found");
  }

  const merged = {
    ...before,
    ...parsed.data,
    anchors: parsed.data.anchors ?? before.anchors,
    style: parsed.data.style === undefined ? before.style : parsed.data.style
  };
  const now = new Date().toISOString();
  const slope = computeSlope(merged.anchors);

  db.prepare(
    `update drawings set
      ticker = ?,
      timeframe = ?,
      type = ?,
      anchors_json = ?,
      style_json = ?,
      slope = ?,
      updated_at = ?
    where id = ?`
  ).run(
    merged.ticker,
    merged.timeframe,
    merged.type,
    JSON.stringify(merged.anchors),
    merged.style === null ? null : JSON.stringify(merged.style),
    slope,
    now,
    id
  );

  const after = getDrawing(db, id);
  if (!after) {
    throw new Error("Drawing update failed");
  }

  recordAudit(db, {
    entityType: "drawing",
    entityId: id,
    action: "update",
    before,
    after
  });

  return after;
}

export function deleteDrawing(db: SqliteDatabase, id: string): DrawingDto {
  const before = getDrawing(db, id);
  if (!before) {
    throw new Error("Drawing not found");
  }

  const now = new Date().toISOString();
  db.prepare("update drawings set deleted_at = ?, updated_at = ? where id = ?").run(now, now, id);

  const after = getDrawing(db, id);
  if (!after) {
    throw new Error("Drawing delete failed");
  }

  recordAudit(db, {
    entityType: "drawing",
    entityId: id,
    action: "delete",
    before,
    after
  });

  return after;
}

export function listDrawings(db: SqliteDatabase, filters: DrawingListFilters): DrawingDto[] {
  const where = ["deleted_at is null"];
  const values: unknown[] = [];

  if (filters.ticker) {
    where.push("ticker = ?");
    values.push(filters.ticker);
  }

  if (filters.timeframe) {
    where.push("timeframe = ?");
    values.push(filters.timeframe);
  }

  if (filters.sessionId !== undefined) {
    if (filters.sessionId === null) {
      where.push("session_id is null");
    } else {
      where.push("session_id = ?");
      values.push(filters.sessionId);
    }
  }

  const rows = db
    .prepare(
      `select *
      from drawings
      where ${where.join(" and ")}
      order by created_at asc`
    )
    .all(...values) as DrawingRow[];

  return rows.map(rowToDto);
}
