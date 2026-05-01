import { describe, expect, it } from "vitest";

import { AlpacaProvider } from "../src/market-data/alpacaProvider.js";

describe("AlpacaProvider", () => {
  it("fails clearly before network requests when credentials are missing", async () => {
    const provider = new AlpacaProvider({
      apiKeyId: "",
      apiSecretKey: ""
    });

    await expect(
      provider.getBars({
        tickers: ["SOXL"],
        timeframe: "1Min",
        start: new Date("2024-01-02T14:30:00.000Z"),
        end: new Date("2024-01-02T21:00:00.000Z")
      })
    ).rejects.toThrow("Alpaca credentials are not configured");
  });

  it("builds a historical bars request without hitting Alpaca", () => {
    const provider = new AlpacaProvider({
      apiKeyId: "key",
      apiSecretKey: "secret"
    });

    const request = provider.buildBarsRequest({
      tickers: ["SOXL", "SOXS"],
      timeframe: "1Min",
      start: new Date("2024-01-02T14:30:00.000Z"),
      end: new Date("2024-01-02T21:00:00.000Z")
    });

    expect(request.url.origin).toBe("https://data.alpaca.markets");
    expect(request.url.pathname).toBe("/v2/stocks/bars");
    expect(request.url.searchParams.get("symbols")).toBe("SOXL,SOXS");
    expect(request.url.searchParams.get("timeframe")).toBe("1Min");
    expect(request.url.searchParams.get("start")).toBe("2024-01-02T14:30:00.000Z");
    expect(request.url.searchParams.get("end")).toBe("2024-01-02T21:00:00.000Z");
    expect(request.url.searchParams.get("adjustment")).toBe("all");
    expect(request.url.searchParams.get("feed")).toBe("iex");
    expect(request.url.searchParams.get("limit")).toBe("10000");
    expect(request.headers).toMatchObject({
      "APCA-API-KEY-ID": "key",
      "APCA-API-SECRET-KEY": "secret"
    });
  });

  it("supports overriding the Alpaca stock feed", () => {
    const provider = new AlpacaProvider({
      apiKeyId: "key",
      apiSecretKey: "secret",
      feed: "sip"
    });

    const request = provider.buildBarsRequest({
      tickers: ["SOXL"],
      timeframe: "1Min",
      start: new Date("2024-01-02T14:30:00.000Z"),
      end: new Date("2024-01-02T21:00:00.000Z")
    });

    expect(request.url.searchParams.get("feed")).toBe("sip");
  });

  it("maps Alpaca bars into normalized base bars", () => {
    const provider = new AlpacaProvider({
      apiKeyId: "key",
      apiSecretKey: "secret"
    });

    const bars = provider.mapBarsResponse({
      bars: {
        SOXL: [
          {
            t: "2024-01-02T14:30:00Z",
            o: 10,
            h: 12,
            l: 9,
            c: 11,
            v: 1000
          }
        ]
      }
    });

    expect(bars).toEqual([
      {
        ticker: "SOXL",
        timestamp: "2024-01-02T14:30:00.000Z",
        open: 10,
        high: 12,
        low: 9,
        close: 11,
        volume: 1000
      }
    ]);
  });
});
