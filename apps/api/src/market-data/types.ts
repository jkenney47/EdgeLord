export type BaseTimeframe = "1Min" | "5Min";

export type BaseBar = {
  ticker: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type GetBarsRequest = {
  tickers: string[];
  timeframe: BaseTimeframe;
  start: Date;
  end: Date;
};

export type MarketDataProvider = {
  getBars(request: GetBarsRequest): Promise<BaseBar[]>;
};
