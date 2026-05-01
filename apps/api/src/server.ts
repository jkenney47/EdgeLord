import Fastify from "fastify";
import cors from "@fastify/cors";

import { loadEnv } from "./config/env.js";
import { openDatabase } from "./db/database.js";
import { runMigrations } from "./db/migrate.js";
import { AlpacaProvider } from "./market-data/alpacaProvider.js";
import { registerChartRoutes } from "./routes/chartRoutes.js";
import { registerDrawingRoutes } from "./routes/drawingRoutes.js";
import { registerExportRoutes } from "./routes/exportRoutes.js";
import { registerImportRoutes } from "./routes/importRoutes.js";
import { registerLabelRoutes } from "./routes/labelRoutes.js";
import { registerReviewRoutes } from "./routes/reviewRoutes.js";
import { registerSessionRoutes } from "./routes/sessionRoutes.js";
import type { SqliteDatabase } from "./db/database.js";
import type { MarketDataProvider } from "./market-data/types.js";

type ServerDependencies = {
  db?: SqliteDatabase;
  marketDataProvider?: MarketDataProvider;
  marketDataProviderName?: string;
};

export function buildServer(dependencies: ServerDependencies = {}) {
  const server = Fastify({
    logger: false
  });

  void server.register(cors, {
    origin: [
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      process.env.WEB_ORIGIN
    ].filter((origin): origin is string => Boolean(origin)),
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
  });

  server.get("/health", async () => {
    return { ok: true };
  });

  if (dependencies.db && dependencies.marketDataProvider) {
    void registerChartRoutes(server, {
      db: dependencies.db
    });
    void registerSessionRoutes(server, {
      db: dependencies.db
    });
    void registerLabelRoutes(server, {
      db: dependencies.db
    });
    void registerDrawingRoutes(server, {
      db: dependencies.db
    });
    void registerExportRoutes(server, {
      db: dependencies.db
    });
    void registerReviewRoutes(server, {
      db: dependencies.db
    });
    void registerImportRoutes(server, {
      db: dependencies.db,
      marketDataProvider: dependencies.marketDataProvider,
      marketDataProviderName: dependencies.marketDataProviderName ?? "alpaca"
    });
  }

  return server;
}

async function main() {
  const env = loadEnv();
  const db = openDatabase(env.DATABASE_PATH);
  runMigrations(db);
  const server = buildServer({
    db,
    marketDataProvider: new AlpacaProvider({
      apiKeyId: env.ALPACA_API_KEY_ID,
      apiSecretKey: env.ALPACA_API_SECRET_KEY,
      feed: env.ALPACA_DATA_FEED
    }),
    marketDataProviderName: "alpaca"
  });

  server.addHook("onClose", async () => {
    db.close();
  });

  await server.listen({
    host: "127.0.0.1",
    port: env.API_PORT
  });

  console.log(`EdgeLord API listening on http://127.0.0.1:${env.API_PORT}`);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
