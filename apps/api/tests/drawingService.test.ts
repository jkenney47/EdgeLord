import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { createDrawing, deleteDrawing, listDrawings, updateDrawing } from "../src/drawings/drawingService.js";
import { runMigrations } from "../src/db/migrate.js";

let db: Database.Database | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

describe("drawing service", () => {
  it("creates, updates, lists, and soft-deletes trendlines with audit records", () => {
    db = new Database(":memory:");
    runMigrations(db);

    const created = createDrawing(db, {
      sessionId: null,
      ticker: "SOXL",
      timeframe: "4H",
      type: "trendline",
      anchors: [
        { timestamp: "2024-01-02T14:30:00.000Z", price: 28.61 },
        { timestamp: "2024-01-03T14:30:00.000Z", price: 31.5 }
      ],
      style: { color: "#f2d35e" }
    });

    expect(created).toMatchObject({
      id: expect.any(String),
      ticker: "SOXL",
      timeframe: "4H",
      type: "trendline",
      slope: expect.any(Number),
      deletedAt: null
    });

    const updated = updateDrawing(db, created.id, {
      anchors: [
        { timestamp: "2024-01-02T14:30:00.000Z", price: 29 },
        { timestamp: "2024-01-04T14:30:00.000Z", price: 32 }
      ]
    });

    expect(updated.anchors[0]).toMatchObject({ price: 29 });
    expect(listDrawings(db, { ticker: "SOXL", timeframe: "4H" })).toHaveLength(1);

    const deleted = deleteDrawing(db, created.id);
    expect(deleted.deletedAt).toEqual(expect.any(String));
    expect(listDrawings(db, { ticker: "SOXL", timeframe: "4H" })).toEqual([]);

    const audits = db
      .prepare("select action from audit_log where entity_type = 'drawing' order by id")
      .all() as Array<{ action: string }>;
    expect(audits.map((row) => row.action)).toEqual(["create", "update", "delete"]);
  });
});
