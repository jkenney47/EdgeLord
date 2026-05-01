import { nanoid } from "nanoid";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { SqliteDatabase } from "../db/database.js";

type SessionRow = {
  id: string;
  name: string;
  start_time: string;
  end_time: string | null;
  ticker_focus: string | null;
  timeframe_focus: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SessionDto = {
  id: string;
  name: string;
  startTime: string;
  endTime: string | null;
  tickerFocus: string | null;
  timeframeFocus: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

const createSessionSchema = z.object({
  name: z.string().min(1).default("Untitled session"),
  tickerFocus: z.string().min(1).nullable().optional(),
  timeframeFocus: z.string().min(1).nullable().optional(),
  notes: z.string().nullable().optional()
});

function toDto(row: SessionRow): SessionDto {
  return {
    id: row.id,
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
    tickerFocus: row.ticker_focus,
    timeframeFocus: row.timeframe_focus,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getSession(db: SqliteDatabase, id: string): SessionDto | null {
  const row = db.prepare("select * from sessions where id = ?").get(id) as SessionRow | undefined;
  return row ? toDto(row) : null;
}

export async function registerSessionRoutes(
  server: FastifyInstance,
  dependencies: { db: SqliteDatabase }
): Promise<void> {
  server.post("/sessions", async (request, reply) => {
    const parsed = createSessionSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid session request",
        issues: parsed.error.issues
      });
    }

    const now = new Date().toISOString();
    const id = nanoid();

    dependencies.db
      .prepare(
        `insert into sessions (
          id,
          name,
          start_time,
          ticker_focus,
          timeframe_focus,
          notes,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parsed.data.name,
        now,
        parsed.data.tickerFocus ?? null,
        parsed.data.timeframeFocus ?? null,
        parsed.data.notes ?? null,
        now,
        now
      );

    return getSession(dependencies.db, id);
  });

  server.get("/sessions", async () => {
    const rows = dependencies.db
      .prepare("select * from sessions order by start_time desc")
      .all() as SessionRow[];
    return rows.map(toDto);
  });

  server.get("/sessions/:id", async (request, reply) => {
    const parsed = z.object({ id: z.string().min(1) }).safeParse(request.params);

    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid session request" });
    }

    const session = getSession(dependencies.db, parsed.data.id);
    if (!session) {
      return reply.code(404).send({ error: "Session not found" });
    }

    return session;
  });

  server.post("/sessions/:id/end", async (request, reply) => {
    const parsed = z.object({ id: z.string().min(1) }).safeParse(request.params);

    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid session request" });
    }

    const now = new Date().toISOString();
    const result = dependencies.db
      .prepare("update sessions set end_time = ?, updated_at = ? where id = ?")
      .run(now, now, parsed.data.id);

    if (result.changes === 0) {
      return reply.code(404).send({ error: "Session not found" });
    }

    return getSession(dependencies.db, parsed.data.id);
  });
}
