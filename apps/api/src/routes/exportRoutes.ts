import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  buildExportManifest,
  exportPairedTradesCsv,
  exportResearchLabelsCsv,
  exportResearchLabelsJsonl,
  exportTradeEventsCsv,
  exportTradeEventsJson,
  exportTrainingFeaturesCsv,
  pairedTradesManifestForExport,
  researchLabelsManifestForExport,
  trainingFeaturesManifestForExport
} from "../export/exportService.js";
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

  server.get("/export/research-labels", async (request, reply) => {
    const parsed = z
      .object({
        format: z.enum(["csv", "jsonl"]).default("csv"),
        sessionId: z.string().min(1).optional(),
        includeFutureVisible: z.coerce.boolean().default(false)
      })
      .safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid research labels export request" });
    }

    const replaySafeOnly = !parsed.data.includeFutureVisible;
    const manifest = researchLabelsManifestForExport(dependencies.db, parsed.data.format, {
      sessionId: parsed.data.sessionId,
      replaySafeOnly
    });

    if (parsed.data.format === "jsonl") {
      return reply
        .header("content-type", "application/x-ndjson; charset=utf-8")
        .header("content-disposition", "attachment; filename=edgelord-labels.jsonl")
        .header("x-edgelord-export-manifest", JSON.stringify(manifest))
        .send(
          exportResearchLabelsJsonl(dependencies.db, {
            sessionId: parsed.data.sessionId,
            replaySafeOnly
          })
        );
    }

    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", "attachment; filename=edgelord-labels.csv")
      .header("x-edgelord-export-manifest", JSON.stringify(manifest))
      .send(
        exportResearchLabelsCsv(dependencies.db, {
          sessionId: parsed.data.sessionId,
          replaySafeOnly
        })
      );
  });

  server.get("/export/training-features", async (request, reply) => {
    const parsed = z
      .object({
        sessionId: z.string().min(1).optional()
      })
      .safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid training features export request" });
    }

    const manifest = trainingFeaturesManifestForExport(dependencies.db, {
      sessionId: parsed.data.sessionId
    });

    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", "attachment; filename=edgelord-training-features.csv")
      .header("x-edgelord-export-manifest", JSON.stringify(manifest))
      .send(
        exportTrainingFeaturesCsv(dependencies.db, {
          sessionId: parsed.data.sessionId
        })
      );
  });

  server.get("/export/paired-trades", async (request, reply) => {
    const parsed = z
      .object({
        sessionId: z.string().min(1).optional(),
        includeIneligible: z.coerce.boolean().default(false)
      })
      .safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid paired trades export request" });
    }

    const trainingEligibleOnly = !parsed.data.includeIneligible;
    const manifest = pairedTradesManifestForExport(dependencies.db, {
      sessionId: parsed.data.sessionId,
      trainingEligibleOnly
    });

    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", "attachment; filename=edgelord-trades.csv")
      .header("x-edgelord-export-manifest", JSON.stringify(manifest))
      .send(
        exportPairedTradesCsv(dependencies.db, {
          sessionId: parsed.data.sessionId,
          trainingEligibleOnly
        })
      );
  });
}
