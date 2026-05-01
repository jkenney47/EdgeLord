import type { SqliteDatabase } from "./database.js";
import { additiveMigrationStatements, createIndexStatements, createTableStatements } from "./schema.js";

function hasColumn(db: SqliteDatabase, table: string, column: string): boolean {
  const rows = db.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

export function runMigrations(db: SqliteDatabase): void {
  const migrate = db.transaction(() => {
    for (const statement of createTableStatements) {
      db.exec(statement);
    }

    for (const migration of additiveMigrationStatements) {
      if (!hasColumn(db, migration.table, migration.column)) {
        db.exec(migration.statement);
      }
    }

    for (const statement of createIndexStatements) {
      db.exec(statement);
    }
  });

  migrate();
}
