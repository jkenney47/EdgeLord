import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { buildReviewSummary } from "../review/reviewService.js";
import type { SqliteDatabase } from "../db/database.js";

export async function registerReviewRoutes(
  server: FastifyInstance,
  dependencies: { db: SqliteDatabase }
): Promise<void> {
  server.get("/review/summary", async (request, reply) => {
    const parsed = z
      .object({
        sessionId: z.string().min(1).optional()
      })
      .safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid review request" });
    }

    return buildReviewSummary(dependencies.db, parsed.data.sessionId);
  });
}
