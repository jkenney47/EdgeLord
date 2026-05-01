import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { recordAudit } from "../src/audit/auditService.js";
import { runMigrations } from "../src/db/migrate.js";

let db: Database.Database | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

describe("audit service", () => {
  it("stores create, update, and delete events with before and after JSON", () => {
    db = new Database(":memory:");
    runMigrations(db);

    recordAudit(db, {
      entityType: "trade_event",
      entityId: "event-1",
      action: "create",
      before: null,
      after: { labelType: "ENTRY", confidence: 4 }
    });

    recordAudit(db, {
      entityType: "trade_event",
      entityId: "event-1",
      action: "update",
      before: { labelType: "ENTRY", confidence: 4 },
      after: { labelType: "ENTRY", confidence: 5 }
    });

    recordAudit(db, {
      entityType: "trade_event",
      entityId: "event-1",
      action: "delete",
      before: { labelType: "ENTRY", confidence: 5 },
      after: null
    });

    const rows = db
      .prepare(
        "select entity_type, entity_id, action, before_json, after_json from audit_log order by id"
      )
      .all() as Array<{
      entity_type: string;
      entity_id: string;
      action: string;
      before_json: string | null;
      after_json: string | null;
    }>;

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      entity_type: "trade_event",
      entity_id: "event-1",
      action: "create",
      before_json: null,
      after_json: JSON.stringify({ labelType: "ENTRY", confidence: 4 })
    });
    expect(rows[1]).toMatchObject({
      action: "update",
      before_json: JSON.stringify({ labelType: "ENTRY", confidence: 4 }),
      after_json: JSON.stringify({ labelType: "ENTRY", confidence: 5 })
    });
    expect(rows[2]).toMatchObject({
      action: "delete",
      before_json: JSON.stringify({ labelType: "ENTRY", confidence: 5 }),
      after_json: null
    });
  });
});
