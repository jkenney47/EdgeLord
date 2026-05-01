import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getChartSeries, getDataCoverage, getSynchronizedChartSeries } from "../chart/chartService.js";
import type { SqliteDatabase } from "../db/database.js";

const timeframeSchema = z.enum(["2H", "4H", "1D"]);

export async function registerChartRoutes(
  server: FastifyInstance,
  dependencies: { db: SqliteDatabase }
): Promise<void> {
  server.get("/chart/coverage", async (request, reply) => {
    const parsed = z
      .object({
        tickers: z
          .string()
          .min(1)
          .default("SOXL,SOXS")
          .transform((value) =>
            value
              .split(",")
              .map((ticker) => ticker.trim().toUpperCase())
              .filter(Boolean)
          ),
        timeframes: z
          .string()
          .min(1)
          .default("1D,4H,2H")
          .transform((value) =>
            value
              .split(",")
              .map((timeframe) => timeframe.trim())
              .filter(Boolean)
          )
      })
      .safeParse(request.query);

    const timeframeParse = parsed.success
      ? z.array(timeframeSchema).safeParse(parsed.data.timeframes)
      : null;

    if (!parsed.success || parsed.data.tickers.length === 0 || !timeframeParse?.success) {
      const issues =
        parsed.success && timeframeParse && !timeframeParse.success
          ? timeframeParse.error.issues
          : parsed.success
            ? []
            : parsed.error.issues;

      return reply.code(400).send({
        error: "Invalid coverage request",
        issues
      });
    }

    return getDataCoverage(dependencies.db, parsed.data.tickers, timeframeParse.data);
  });

  server.get("/chart/:ticker/:timeframe", async (request, reply) => {
    const parsed = z
      .object({
        ticker: z.string().min(1),
        timeframe: timeframeSchema
      })
      .safeParse(request.params);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid chart request",
        issues: parsed.error.issues
      });
    }

    return getChartSeries(
      dependencies.db,
      parsed.data.ticker.toUpperCase(),
      parsed.data.timeframe
    );
  });

  server.get("/chart/sync", async (request, reply) => {
    const parsed = z
      .object({
        timeframe: timeframeSchema,
        tickers: z
          .string()
          .min(1)
          .transform((value) =>
            value
              .split(",")
              .map((ticker) => ticker.trim().toUpperCase())
              .filter(Boolean)
          )
      })
      .safeParse(request.query);

    if (!parsed.success || parsed.data.tickers.length === 0) {
      return reply.code(400).send({
        error: "Invalid chart request",
        issues: parsed.success ? [] : parsed.error.issues
      });
    }

    return getSynchronizedChartSeries(
      dependencies.db,
      parsed.data.tickers,
      parsed.data.timeframe
    );
  });
}
