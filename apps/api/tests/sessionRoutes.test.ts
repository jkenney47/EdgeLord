import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { runMigrations } from "../src/db/migrate.js";
import { buildServer } from "../src/server.js";
import type { MarketDataProvider } from "../src/market-data/types.js";

let db: Database.Database | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

function serverWithDb() {
  const provider: MarketDataProvider = {
    async getBars() {
      return [];
    }
  };

  return buildServer({
    db,
    marketDataProvider: provider,
    marketDataProviderName: "alpaca"
  });
}

describe("session routes", () => {
  it("creates and lists sessions", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const server = serverWithDb();

    const createResponse = await server.inject({
      method: "POST",
      url: "/sessions",
      payload: {
        name: "Morning replay",
        tickerFocus: "SOXL/SOXS",
        timeframeFocus: "4H",
        notes: "First pass"
      }
    });

    expect(createResponse.statusCode).toBe(200);
    const created = createResponse.json();
    expect(created).toMatchObject({
      id: expect.any(String),
      name: "Morning replay",
      tickerFocus: "SOXL/SOXS",
      timeframeFocus: "4H",
      notes: "First pass",
      endTime: null
    });

    const listResponse = await server.inject({
      method: "GET",
      url: "/sessions"
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual([created]);

    await server.close();
  });

  it("resumes and ends a session", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const server = serverWithDb();

    const created = (
      await server.inject({
        method: "POST",
        url: "/sessions",
        payload: {
          name: "Replay block"
        }
      })
    ).json();

    const resumeResponse = await server.inject({
      method: "GET",
      url: `/sessions/${created.id}`
    });

    expect(resumeResponse.statusCode).toBe(200);
    expect(resumeResponse.json()).toMatchObject({
      id: created.id,
      name: "Replay block",
      endTime: null
    });

    const endResponse = await server.inject({
      method: "POST",
      url: `/sessions/${created.id}/end`
    });

    expect(endResponse.statusCode).toBe(200);
    expect(endResponse.json()).toMatchObject({
      id: created.id,
      endTime: expect.any(String)
    });

    await server.close();
  });
});
