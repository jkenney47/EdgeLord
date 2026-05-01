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

describe("drawing routes", () => {
  it("creates, lists, updates, and deletes drawings", async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const server = serverWithDb();

    const createResponse = await server.inject({
      method: "POST",
      url: "/drawings",
      payload: {
        ticker: "SOXL",
        timeframe: "4H",
        type: "trendline",
        anchors: [
          { timestamp: "2024-01-02T14:30:00.000Z", price: 28.61 },
          { timestamp: "2024-01-03T14:30:00.000Z", price: 31.5 }
        ],
        style: { color: "#f2d35e" }
      }
    });

    expect(createResponse.statusCode).toBe(200);
    const created = createResponse.json();
    expect(created).toMatchObject({
      id: expect.any(String),
      ticker: "SOXL",
      timeframe: "4H",
      type: "trendline"
    });

    const listResponse = await server.inject({
      method: "GET",
      url: "/drawings?ticker=SOXL&timeframe=4H"
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toHaveLength(1);

    const updateResponse = await server.inject({
      method: "PATCH",
      url: `/drawings/${created.id}`,
      payload: {
        anchors: [
          { timestamp: "2024-01-02T14:30:00.000Z", price: 29 },
          { timestamp: "2024-01-03T14:30:00.000Z", price: 31.5 }
        ]
      }
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().anchors[0]).toMatchObject({ price: 29 });

    const deleteResponse = await server.inject({
      method: "DELETE",
      url: `/drawings/${created.id}`
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json().deletedAt).toEqual(expect.any(String));

    await server.close();
  });
});
