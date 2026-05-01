import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createDrawing,
  deleteDrawing,
  listDrawings,
  updateDrawing
} from "../drawings/drawingService.js";
import type { SqliteDatabase } from "../db/database.js";

const drawingAnchorSchema = z.object({
  timestamp: z.string().min(1),
  price: z.number()
});

const drawingPayloadSchema = z.object({
  sessionId: z.string().min(1).nullable().optional(),
  ticker: z.string().min(1),
  timeframe: z.string().min(1),
  type: z.enum(["trendline", "horizontal_level", "breakout_marker"]),
  anchors: z.array(drawingAnchorSchema).min(1),
  style: z.unknown().nullable().optional()
});

const updateDrawingPayloadSchema = drawingPayloadSchema.partial().omit({
  sessionId: true
});

export async function registerDrawingRoutes(
  server: FastifyInstance,
  dependencies: { db: SqliteDatabase }
): Promise<void> {
  server.post("/drawings", async (request, reply) => {
    const parsed = drawingPayloadSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid drawing request",
        issues: parsed.error.issues
      });
    }

    try {
      return createDrawing(dependencies.db, parsed.data);
    } catch (error) {
      return reply.code(400).send({
        error: "Invalid drawing request",
        message: error instanceof Error ? error.message : "Unknown drawing failure"
      });
    }
  });

  server.get("/drawings", async (request, reply) => {
    const parsed = z
      .object({
        ticker: z.string().min(1).optional(),
        timeframe: z.string().min(1).optional(),
        sessionId: z.string().min(1).optional()
      })
      .safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid drawing request" });
    }

    return listDrawings(dependencies.db, parsed.data);
  });

  server.patch("/drawings/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    const parsed = updateDrawingPayloadSchema.safeParse(request.body ?? {});

    if (!params.success || !parsed.success) {
      return reply.code(400).send({ error: "Invalid drawing request" });
    }

    try {
      return updateDrawing(dependencies.db, params.data.id, parsed.data);
    } catch (error) {
      return reply.code(404).send({
        error: "Drawing not found",
        message: error instanceof Error ? error.message : "Unknown drawing failure"
      });
    }
  });

  server.delete("/drawings/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: "Invalid drawing request" });
    }

    try {
      return deleteDrawing(dependencies.db, params.data.id);
    } catch (error) {
      return reply.code(404).send({
        error: "Drawing not found",
        message: error instanceof Error ? error.message : "Unknown drawing failure"
      });
    }
  });
}
