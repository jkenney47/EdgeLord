import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { buildExportManifest, exportTradeEventsCsv, exportTradeEventsJson } from "../export/exportService.js";
import { buildExportValidationReport } from "../export/exportValidationService.js";
import type { SqliteDatabase } from "../db/database.js";

export async function registerExportRoutes(
  server: FastifyInstance,
  dependencies: { db: SqliteDatabase }
): Promise<void> {
  server.get("/export/trade-events/validation", async (request, reply) => {
    const parsed = z
      .object({
        sessionId: z.string().min(1).optional()
      })
      .safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid export validation request" });
    }

    const validation = buildExportValidationReport(dependencies.db, {
      sessionId: parsed.data.sessionId
    });
    return {
      ...validation,
      manifest: buildExportManifest("json", parsed.data.sessionId, validation.summary.totalLabels, validation)
    };
  });

  server.get("/export/trade-events", async (request, reply) => {
    const parsed = z
      .object({
        format: z.enum(["json", "csv"]).default("json"),
        sessionId: z.string().min(1).optional(),
        allowBlocked: z.coerce.boolean().default(false)
      })
      .safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid export request" });
    }

    const validation = buildExportValidationReport(dependencies.db, {
      sessionId: parsed.data.sessionId
    });

    if (validation.status === "fail" && !parsed.data.allowBlocked) {
      return reply.code(409).send({
        error: "Export blocked by validation errors",
        validation,
        manifest: buildExportManifest(parsed.data.format, parsed.data.sessionId, validation.summary.totalLabels, validation)
      });
    }

    if (parsed.data.format === "csv") {
      return reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("content-disposition", "attachment; filename=edgelord-trade-events.csv")
        .header(
          "x-edgelord-export-manifest",
          JSON.stringify(buildExportManifest("csv", parsed.data.sessionId, validation.summary.totalLabels, validation))
        )
        .send(exportTradeEventsCsv(dependencies.db, parsed.data.sessionId));
    }

    return reply
      .header("content-disposition", "attachment; filename=edgelord-trade-events.json")
      .send(exportTradeEventsJson(dependencies.db, parsed.data.sessionId, validation));
  });
}
