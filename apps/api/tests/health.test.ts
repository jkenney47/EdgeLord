import { describe, expect, it } from "vitest";

import { buildServer } from "../src/server.js";

describe("health route", () => {
  it("returns ok", async () => {
    const server = buildServer();

    const response = await server.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await server.close();
  });

  it("allows local web app requests", async () => {
    const server = buildServer();

    const response = await server.inject({
      method: "GET",
      url: "/health",
      headers: {
        origin: "http://127.0.0.1:5173"
      }
    });

    expect(response.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");

    await server.close();
  });

  it("allows local label mutation preflight requests", async () => {
    const server = buildServer();

    const response = await server.inject({
      method: "OPTIONS",
      url: "/labels/label-1",
      headers: {
        origin: "http://127.0.0.1:5173",
        "access-control-request-method": "PATCH"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toContain("PATCH");
    expect(response.headers["access-control-allow-methods"]).toContain("DELETE");

    await server.close();
  });
});
