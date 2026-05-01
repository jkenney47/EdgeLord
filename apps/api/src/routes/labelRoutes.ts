import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createTradeEvent,
  deleteTradeEvent,
  listTradeEvents,
  listTradeEventsForSession,
  updateTradeEvent
} from "../labels/labelService.js";
import { calculateOutcomeForLabel } from "../outcomes/outcomeService.js";
import type { SqliteDatabase } from "../db/database.js";

const tradeEventPayloadSchema = z.object({
  sessionId: z.string().min(1),
  timestamp: z.string().min(1),
  ticker: z.string().min(1),
  timeframe: z.string().min(1),
  labelType: z.enum(["ENTRY", "EXIT", "SKIP", "INVALID"]),
  price: z.number(),
  confidence: z.number().int().min(1).max(5),
  setupQuality: z.number().int().min(1).max(5),
  reasonCodes: z.array(
    z.enum([
      "trendline_break",
      "stoch_rsi_condition",
      "ema_alignment",
      "volatility_expansion",
      "inverse_etf_confirmation",
      "other"
    ])
  ),
  notes: z.string().nullable().optional(),
  decisionPhase: z.enum(["at_close", "at_open", "intrabar"]).optional(),
  captureMode: z.enum(["regular", "replay"]).optional(),
  visibleUntilTimestamp: z.string().min(1).nullable().optional(),
  potentialVisualLeakage: z.boolean().optional(),
  selectedBarIndex: z.number().int().min(0).nullable().optional(),
  setupId: z.string().min(1).nullable().optional(),
  tradeId: z.string().min(1).nullable().optional(),
  parentLabelId: z.string().min(1).nullable().optional(),
  decisionRole: z.enum(["setup_start", "trigger", "entry", "management", "exit", "skip", "invalid"]).optional(),
  bias: z.enum(["long", "short", "neutral", "unclear"]).optional(),
  marketBias: z.enum(["bullish_semis", "bearish_semis", "neutral", "unclear"]).optional(),
  tradeDirection: z.enum(["long_ticker", "short_ticker", "observe_only"]).optional(),
  instrumentRole: z.enum(["primary", "inverse_pair", "confirmation"]).optional(),
  pairedTickerRole: z.enum(["confirmation", "divergence", "ignored", "inverse_signal"]).optional(),
  entryStyle: z.string().min(1).nullable().optional(),
  exitStyle: z.string().min(1).nullable().optional(),
  invalidationPrice: z.number().nullable().optional(),
  targetPrice: z.number().nullable().optional(),
  outcomeAvailable: z.boolean().optional(),
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
  outcomeStatus: z
    .enum([
      "not_computed",
      "pending",
      "computed",
      "insufficient_future_bars",
      "missing_exit",
      "invalidated"
    ])
    .optional(),
  outcomeRuleVersion: z.string().min(1).nullable().optional(),
  multiTimeframeContext: z.unknown().optional(),
  indicatorSnapshot: z.unknown(),
  structureSnapshot: z.unknown(),
  drawingContext: z.unknown()
});

const updateTradeEventPayloadSchema = tradeEventPayloadSchema.partial().omit({
  sessionId: true
});
const outcomeCalculationPayloadSchema = z.object({
  horizonBars: z.number().int().min(1).max(250).optional()
});

export async function registerLabelRoutes(
  server: FastifyInstance,
  dependencies: { db: SqliteDatabase }
): Promise<void> {
  server.post("/labels", async (request, reply) => {
    const parsed = tradeEventPayloadSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid label request",
        issues: parsed.error.issues
      });
    }

    try {
      return createTradeEvent(dependencies.db, parsed.data);
    } catch (error) {
      return reply.code(400).send({
        error: "Invalid label request",
        message: error instanceof Error ? error.message : "Unknown label failure"
      });
    }
  });

  server.patch("/labels/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    const parsed = updateTradeEventPayloadSchema.safeParse(request.body ?? {});

    if (!params.success || !parsed.success) {
      return reply.code(400).send({ error: "Invalid label request" });
    }

    try {
      return updateTradeEvent(dependencies.db, params.data.id, parsed.data);
    } catch (error) {
      return reply.code(404).send({
        error: "Label not found",
        message: error instanceof Error ? error.message : "Unknown label failure"
      });
    }
  });

  server.post("/labels/:id/outcome", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    const parsed = outcomeCalculationPayloadSchema.safeParse(request.body ?? {});

    if (!params.success || !parsed.success) {
      return reply.code(400).send({ error: "Invalid outcome calculation request" });
    }

    try {
      return calculateOutcomeForLabel(dependencies.db, params.data.id, parsed.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown outcome calculation failure";
      return reply.code(message.includes("not found") ? 404 : 400).send({
        error: "Outcome calculation failed",
        message
      });
    }
  });

  server.delete("/labels/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: "Invalid label request" });
    }

    try {
      return deleteTradeEvent(dependencies.db, params.data.id);
    } catch (error) {
      return reply.code(404).send({
        error: "Label not found",
        message: error instanceof Error ? error.message : "Unknown label failure"
      });
    }
  });

  server.get("/labels", async (request, reply) => {
    const parsed = z
      .object({
        sessionId: z.string().min(1).optional()
      })
      .safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid label request" });
    }

    if (!parsed.data.sessionId) {
      return listTradeEvents(dependencies.db);
    }

    return listTradeEventsForSession(dependencies.db, parsed.data.sessionId);
  });
}
