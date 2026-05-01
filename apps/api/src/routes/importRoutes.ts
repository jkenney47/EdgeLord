import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { importMarketData } from "../market-data/importService.js";
import type { SqliteDatabase } from "../db/database.js";
import type { MarketDataProvider } from "../market-data/types.js";

function defaultStartDate(): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

const importRequestSchema = z.object({
  tickers: z.array(z.string().min(1)).default(["SOXL", "SOXS"]),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .default(defaultStartDate),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .default(() => new Date().toISOString().slice(0, 10)),
  baseTimeframe: z.enum(["1Min", "5Min"]).default("1Min")
});

export type ImportRouteDependencies = {
  db: SqliteDatabase;
  marketDataProvider: MarketDataProvider;
  marketDataProviderName: string;
};

export async function registerImportRoutes(
  server: FastifyInstance,
  dependencies: ImportRouteDependencies
): Promise<void> {
  server.post("/import", async (request, reply) => {
    const parsed = importRequestSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid import request",
        issues: parsed.error.issues
      });
    }

    try {
      const result = await importMarketData({
        db: dependencies.db,
        providerName: dependencies.marketDataProviderName,
        provider: dependencies.marketDataProvider,
        request: parsed.data
      });

      return result;
    } catch (error) {
      return reply.code(502).send({
        error: "Import failed",
        message: error instanceof Error ? error.message : "Unknown import failure"
      });
    }
  });
}
