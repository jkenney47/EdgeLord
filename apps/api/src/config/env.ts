import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4317),
  DATABASE_PATH: z.string().min(1).default("../../data/edgelord.sqlite"),
  ALPACA_API_KEY_ID: z.string().default(""),
  ALPACA_API_SECRET_KEY: z.string().default(""),
  ALPACA_DATA_FEED: z.enum(["iex", "sip"]).default("iex")
});

export type AppEnv = z.infer<typeof envSchema>;

function defaultEnvPath(): string {
  return resolve(process.cwd(), "../../.env");
}

export function loadEnv(
  source: NodeJS.ProcessEnv = process.env,
  envPath = defaultEnvPath()
): AppEnv {
  const fileEnv = existsSync(envPath) ? parse(readFileSync(envPath)) : {};
  return envSchema.parse({
    ...fileEnv,
    ...source
  });
}
