import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createSchemaSql } from "./schema";

const dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(dirname, "../../..");
const dataDir = path.resolve(repoRoot, "data");
const dbPath = process.env.EDGELORD_DB_PATH ?? path.join(dataDir, "edgelord.sqlite");

fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(createSchemaSql);

export function nowIso(): string {
  return new Date().toISOString();
}
