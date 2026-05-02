import cors from "@fastify/cors";
import dotenv from "dotenv";
import Fastify from "fastify";
import path from "node:path";
import { z } from "zod";

import { clearBars, getBars, getBarsSummary, hasChartBars, importRawBars } from "./bars";
import { CsvImportValidationError, parseBarsCsv, readCsvFile } from "./csvImport";
import { repoRoot } from "./db";
import { exportManifest, labelsCsv, labelsJsonl, tradesCsv, trainingFeaturesCsv } from "./export";
import { createLabel, createLabelSchema, deleteLabel, getActiveLabelCount, getLabels, patchLabel, patchLabelSchema } from "./labels";
import type { ChartTimeframe, Ticker } from "./schema";
import { getOpenTrade, getTrades } from "./trades";

dotenv.config({ path: path.join(repoRoot, ".env") });

const app = Fastify({
  logger: true,
  bodyLimit: 200 * 1024 * 1024
});
await app.register(cors, { origin: true });
app.addContentTypeParser(["text/csv", "text/plain"], { parseAs: "string" }, (_request, body, done) => {
  done(null, body);
});

function seedSampleData() {
  if (hasChartBars()) return;
  const samplePath = path.join(repoRoot, "data", "sample-bars.csv");
  const csv = readCsvFile(samplePath);
  importRawBars(parseBarsCsv(csv, "sample"));
}

seedSampleData();

app.get("/health", async () => ({ ok: true }));

app.post("/import/csv", async (request, reply) => {
  const bodySchema = z.union([
    z.string(),
    z.object({
      csv: z.string().optional(),
      path: z.string().optional(),
      replaceBars: z.boolean().optional(),
      forceReplaceBars: z.boolean().optional()
    })
  ]);
  const body = bodySchema.parse(request.body);
  const labelCount = getActiveLabelCount();
  if (typeof body !== "string" && body.replaceBars && labelCount > 0 && !body.forceReplaceBars) {
    return reply.status(409).send({
      error: "Refusing to replace bars while active labels exist. Run pnpm labels:integrity first, export a backup, then retry with forceReplaceBars only if you intend to revalidate labels.",
      activeLabels: labelCount
    });
  }
  try {
    const csv = typeof body === "string"
      ? body
      : body.csv ?? (body.path ? readCsvFile(path.resolve(repoRoot, body.path)) : "");
    const rawBars = parseBarsCsv(csv, "csv");
    const replacedBars = typeof body === "string" ? 0 : body.replaceBars ? clearBars() : 0;
    const result = importRawBars(rawBars);
    return reply.send({ ...result, replacedBars });
  } catch (error) {
    if (error instanceof CsvImportValidationError) {
      return reply.status(400).send({
        error: "CSV import failed validation",
        issues: error.issues.slice(0, 25),
        issueCount: error.issues.length
      });
    }
    throw error;
  }
});

app.get("/bars", async (request) => {
  const query = z.object({
    ticker: z.enum(["SOXL", "SOXS"]),
    timeframe: z.enum(["1D", "4H", "2H"])
  }).parse(request.query);
  return { bars: getBars(query.ticker as Ticker, query.timeframe as ChartTimeframe) };
});

app.get("/bars/summary", async () => ({ rows: getBarsSummary() }));

app.get("/labels", async () => ({ labels: getLabels() }));
app.post("/labels", async (request, reply) => {
  try {
    return createLabel(createLabelSchema.parse(request.body));
  } catch (error) {
    return reply.status(400).send({ error: error instanceof Error ? error.message : "Could not create label" });
  }
});
app.patch("/labels/:id", async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  try {
    return { label: patchLabel(params.id, patchLabelSchema.parse(request.body)) };
  } catch (error) {
    return reply.status(404).send({ error: error instanceof Error ? error.message : "Could not patch label" });
  }
});
app.delete("/labels/:id", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  deleteLabel(params.id);
  return { ok: true };
});

app.get("/trades", async () => ({ trades: getTrades() }));
app.get("/state/open-trade", async () => ({ openTrade: getOpenTrade() }));

app.get("/export/labels.csv", async (_request, reply) => reply.type("text/csv").send(labelsCsv(getLabels())));
app.get("/export/trades.csv", async (_request, reply) => reply.type("text/csv").send(tradesCsv(getTrades())));
app.get("/export/training-features.csv", async (_request, reply) => reply.type("text/csv").send(trainingFeaturesCsv(getLabels())));
app.get("/export/labels.jsonl", async (_request, reply) => reply.type("application/x-ndjson").send(labelsJsonl(getLabels())));
app.get("/export/manifest.json", async () => exportManifest(getLabels(), getTrades()));

const port = Number(process.env.API_PORT ?? 4317);
await app.listen({ host: "127.0.0.1", port });
