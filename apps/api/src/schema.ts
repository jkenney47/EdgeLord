export type Ticker = "SOXL" | "SOXS";
export type Timeframe = "RAW" | "2H" | "4H" | "1D";
export type ChartTimeframe = Exclude<Timeframe, "RAW">;
export type LabelAction = "ENTRY" | "EXIT" | "SKIP" | "INVALID";
export type LabelSource = "actual_trade" | "retrospective_replay" | "retrospective_hindsight";
export type CaptureMode = "replay" | "regular";
export type TradeStatus = "open" | "closed" | "invalid";

export type Bar = {
  id?: number;
  ticker: Ticker;
  timeframe: Timeframe;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: string;
  adjusted: number;
};

export type Label = {
  id: string;
  label_source: LabelSource;
  training_eligible: number;
  action: LabelAction;
  ticker: Ticker;
  timeframe: ChartTimeframe;
  timestamp: string;
  bar_index: number;
  chart_price: number;
  execution_price: number | null;
  trade_id: string | null;
  parent_entry_label_id: string | null;
  capture_mode: CaptureMode;
  visible_until_timestamp: string;
  potential_visual_leakage: number;
  confidence: number | null;
  setup_quality: number | null;
  reason_codes_json: string;
  notes: string | null;
  features_json: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
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
  status: TradeStatus;
  created_at: string;
  updated_at: string;
};

export const createSchemaSql = `
create table if not exists bars (
  id integer primary key autoincrement,
  ticker text not null,
  timeframe text not null,
  timestamp text not null,
  open real not null,
  high real not null,
  low real not null,
  close real not null,
  volume real not null,
  source text not null,
  adjusted integer not null default 1,
  unique(ticker, timeframe, timestamp)
);

create table if not exists labels (
  id text primary key,
  label_source text not null,
  training_eligible integer not null,
  action text not null,
  ticker text not null,
  timeframe text not null,
  timestamp text not null,
  bar_index integer not null,
  chart_price real not null,
  execution_price real,
  trade_id text,
  parent_entry_label_id text,
  capture_mode text not null,
  visible_until_timestamp text not null,
  potential_visual_leakage integer not null,
  confidence integer,
  setup_quality integer,
  reason_codes_json text not null default '[]',
  notes text,
  features_json text not null default '{}',
  created_at text not null,
  updated_at text not null,
  deleted_at text
);

create table if not exists trades (
  id text primary key,
  ticker text not null,
  entry_label_id text not null,
  exit_label_id text,
  entry_timestamp text not null,
  exit_timestamp text,
  entry_price real not null,
  exit_price real,
  return_pct real,
  status text not null,
  created_at text not null,
  updated_at text not null
);

create index if not exists idx_bars_summary_lookup
  on bars (ticker, timeframe, source, timestamp);
`;
