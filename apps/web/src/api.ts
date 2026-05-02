export type Ticker = "SOXL" | "SOXS";
export type Timeframe = "1D" | "4H" | "2H";
export type LabelAction = "ENTRY" | "EXIT" | "SKIP" | "INVALID";
export type LabelSource = "actual_trade" | "retrospective_replay" | "retrospective_hindsight";
export type CaptureMode = "replay" | "regular";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4317";

export type Bar = {
  ticker: Ticker;
  timeframe: Timeframe;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Label = {
  id: string;
  label_source: LabelSource;
  training_eligible: number;
  action: LabelAction;
  ticker: Ticker;
  timeframe: Timeframe;
  timestamp: string;
  bar_index: number;
  chart_price: number;
  trade_id: string | null;
  parent_entry_label_id: string | null;
  capture_mode: CaptureMode;
  visible_until_timestamp: string;
  potential_visual_leakage: number;
  created_at: string;
};

export type Trade = {
  id: string;
  ticker: Ticker;
  entry_label_id: string;
  exit_label_id: string | null;
  entry_timestamp: string;
  exit_timestamp: string | null;
  entry_price: number;
  exit_price: number | null;
  return_pct: number | null;
  status: "open" | "closed" | "invalid";
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchBars(ticker: Ticker, timeframe: Timeframe): Promise<Bar[]> {
  const params = new URLSearchParams({ ticker, timeframe });
  const data = await request<{ bars: Bar[] }>(`/bars?${params.toString()}`);
  return data.bars;
}

export async function fetchLabels(): Promise<Label[]> {
  return (await request<{ labels: Label[] }>("/labels")).labels;
}

export async function fetchTrades(): Promise<Trade[]> {
  return (await request<{ trades: Trade[] }>("/trades")).trades;
}

export async function fetchOpenTrade(): Promise<Trade | null> {
  return (await request<{ openTrade: Trade | null }>("/state/open-trade")).openTrade;
}

export async function createLabel(input: {
  labelSource: LabelSource;
  action: LabelAction;
  ticker: Ticker;
  timeframe: Timeframe;
  timestamp: string;
  chartPrice: number;
  captureMode: CaptureMode;
  visibleUntilTimestamp: string;
  potentialVisualLeakage: boolean;
}): Promise<{ label: Label; openTrade: Trade | null }> {
  return request("/labels", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function deleteLabel(id: string): Promise<void> {
  await request(`/labels/${id}`, { method: "DELETE" });
}

export function exportUrl(name: "labels.csv" | "trades.csv" | "training-features.csv" | "labels.jsonl"): string {
  return `${API_BASE}/export/${name}`;
}
