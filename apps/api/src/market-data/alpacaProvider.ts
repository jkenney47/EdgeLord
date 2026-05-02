import type { BaseBar, GetBarsRequest, MarketDataProvider } from "./types.js";

type AlpacaProviderConfig = {
  apiKeyId: string;
  apiSecretKey: string;
  baseUrl?: string;
  feed?: "iex" | "sip";
  adjustment?: "raw" | "split" | "dividend" | "all";
  retryDelayMs?: number;
  maxRetries?: number;
};

type AlpacaBar = {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

type AlpacaBarsResponse = {
  bars?: Record<string, AlpacaBar[]>;
  next_page_token?: string | null;
};

type BarsHttpRequest = {
  url: URL;
  headers: Record<string, string>;
};

export class AlpacaProvider implements MarketDataProvider {
  private readonly apiKeyId: string;
  private readonly apiSecretKey: string;
  private readonly baseUrl: string;
  private readonly feed: "iex" | "sip";
  private readonly adjustment: "raw" | "split" | "dividend" | "all";
  private readonly retryDelayMs: number;
  private readonly maxRetries: number;

  constructor(config: AlpacaProviderConfig) {
    this.apiKeyId = config.apiKeyId;
    this.apiSecretKey = config.apiSecretKey;
    this.baseUrl = config.baseUrl ?? "https://data.alpaca.markets";
    this.feed = config.feed ?? "iex";
    this.adjustment = config.adjustment ?? "all";
    this.retryDelayMs = config.retryDelayMs ?? 60_000;
    this.maxRetries = config.maxRetries ?? 3;
  }

  buildBarsRequest(request: GetBarsRequest, pageToken?: string): BarsHttpRequest {
    const url = new URL("/v2/stocks/bars", this.baseUrl);
    url.searchParams.set("symbols", request.tickers.join(","));
    url.searchParams.set("timeframe", request.timeframe);
    url.searchParams.set("start", request.start.toISOString());
    url.searchParams.set("end", request.end.toISOString());
    url.searchParams.set("adjustment", this.adjustment);
    url.searchParams.set("feed", this.feed);
    url.searchParams.set("limit", "10000");

    if (pageToken) {
      url.searchParams.set("page_token", pageToken);
    }

    return {
      url,
      headers: {
        "APCA-API-KEY-ID": this.apiKeyId,
        "APCA-API-SECRET-KEY": this.apiSecretKey
      }
    };
  }

  mapBarsResponse(response: AlpacaBarsResponse): BaseBar[] {
    const bars = response.bars ?? {};

    return Object.entries(bars).flatMap(([ticker, tickerBars]) =>
      tickerBars.map((bar) => ({
        ticker,
        timestamp: new Date(bar.t).toISOString(),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v
      }))
    );
  }

  async getBars(request: GetBarsRequest): Promise<BaseBar[]> {
    if (!this.apiKeyId || !this.apiSecretKey) {
      throw new Error("Alpaca credentials are not configured");
    }

    const allBars: BaseBar[] = [];
    let pageToken: string | undefined;

    do {
      const httpRequest = this.buildBarsRequest(request, pageToken);
      let response: Response | null = null;

      for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
        response = await fetch(httpRequest.url, {
          headers: httpRequest.headers
        });

        if (response.status !== 429 || attempt === this.maxRetries) {
          break;
        }

        const retryAfterSeconds = Number(response.headers.get("retry-after"));
        const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : this.retryDelayMs;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      if (!response?.ok) {
        throw new Error(`Alpaca bars request failed: ${response.status}`);
      }

      const body = (await response.json()) as AlpacaBarsResponse;
      allBars.push(...this.mapBarsResponse(body));
      pageToken = body.next_page_token ?? undefined;
    } while (pageToken);

    return allBars.sort((a, b) => {
      if (a.ticker !== b.ticker) {
        return a.ticker.localeCompare(b.ticker);
      }

      return a.timestamp.localeCompare(b.timestamp);
    });
  }
}
